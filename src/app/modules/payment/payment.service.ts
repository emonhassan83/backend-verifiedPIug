import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { PAYMENT_MODEL_TYPE, TPayment } from './payment.interface'
import { Payment } from './payment.model'
import {
  createPaystackCheckoutSession,
  createPaystackSubscriptionCheckout,
  handlePaystackWebhook,
  paymentNotifyToAdmin,
  paymentNotifyToUser,
  refundPaystackPayment,
  verifyPaystackSubscription,
  verifyPaystackTransaction,
} from './payment.utils'
import { generateTransactionId } from '../../utils/generateTransctionId'
import mongoose, { startSession } from 'mongoose'
import { PAYMENT_STATUS } from './payment.constant'
import { TSubscriptions } from '../subscription/subscription.interface'
import { Subscription } from '../subscription/subscription.models'
import { User } from '../user/user.model'
import { Package } from '../package/package.model'
import { TOrder } from '../order/order.interface'
import { Order } from '../order/order.models'
import { ORDER_STATUS } from '../order/order.constants'
import { Project } from '../project/project.models'
import { PROJECT_STATUS } from '../project/project.constants'

const checkout = async (payload: TPayment) => {
  const transactionId = generateTransactionId()
  const { modelType, user: userId, reference, type } = payload

  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  let order: TOrder | null = null
  let subscription: TSubscriptions | null = null

  // Fetch model
  if (modelType === PAYMENT_MODEL_TYPE.Order) {
    order = await Order.findById(reference)
    if (!order) {
      throw new AppError(httpStatus.NOT_FOUND, 'Order Not Found!')
    }
  } else if (modelType === PAYMENT_MODEL_TYPE.Subscription) {
    subscription = await Subscription.findById(reference).populate('package')
    if (!subscription) {
      throw new AppError(httpStatus.NOT_FOUND, 'Subscription Not Found!')
    }
  } else {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid model type')
  }

  // ── NEW LOGIC: Prevent duplicate payment for completed steps ──
  if (modelType === PAYMENT_MODEL_TYPE.Order && order) {
    if (type === 'initial' && order.initialPayCompleted) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Initial payment for this order is already completed.',
      )
    }

    if (type === 'final' && order.finalPayCompleted) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Final payment for this order is already completed.',
      )
    }

    // Also check if total is already fully paid
    if (order.isFullyPaid) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'This order is already fully paid.',
      )
    }
  }

  // Check for existing unpaid payment of same type
  let paymentData = await Payment.findOne({
    reference,
    user: userId,
    type,
    isPaid: false,
  })

  if (paymentData) {
    // Reuse existing unpaid payment (update transactionId)
    paymentData = await Payment.findByIdAndUpdate(
      paymentData._id,
      { transactionId },
      { new: true },
    )
  } else {
    // Create new payment
    payload.transactionId = transactionId

    // Set correct amount based on payment type
    if (modelType === PAYMENT_MODEL_TYPE.Order && order) {
      payload.amount =
        type === 'initial' ? order.initialAmount : order.pendingAmount
    } else {
      // @ts-ignore
      payload.amount = subscription?.amount
    }

    paymentData = await Payment.create(payload)
  }

  if (!paymentData) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create/update payment',
    )
  }

  // Handle Subscription checkout
  if (subscription) {
    return await createPaystackSubscriptionCheckout({
      userId,
      packageId: reference,
      paymentId: paymentData._id,
    })
  }

  // Handle Order checkout
  if (order) {
    const checkoutSessionUrl = await createPaystackCheckoutSession({
      product: {
        amount: paymentData.amount,
        name: `Order ${type === 'initial' ? 'Initial' : 'Final'} Payment - ${order.title}`,
        quantity: 1,
      },
      customer: {
        name: user?.name || '',
        email: user?.email || '',
      },
      paymentId: paymentData._id,
    })

    return checkoutSessionUrl
  }

  // Fallback
  throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Unexpected model type')
}

const confirmPayment = async (query: Record<string, any>) => {
  const { reference, paymentId } = query
  let verifiedPaymentId: number | null = null

  const maxRetries = 3
  let attempt = 0

  while (attempt < maxRetries) {
    const session = await startSession()
    try {
      session.startTransaction()

      const payment = await Payment.findById(paymentId).session(session)
      if (!payment) {
        throw new AppError(httpStatus.NOT_FOUND, 'Payment not found!')
      }

      let verification
      if (payment.modelType === PAYMENT_MODEL_TYPE.Subscription) {
        verification = await verifyPaystackSubscription(reference)
      } else {
        verification = await verifyPaystackTransaction(reference)
      }

      if (!verification.status || verification.data.status !== 'success') {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Payment verification failed',
        )
      }

      verifiedPaymentId = verification.data.id

      // Update payment
      const result = await Payment.findByIdAndUpdate(
        paymentId,
        {
          isPaid: true,
          status: PAYMENT_STATUS.paid,
          paymentIntentId: verification.data.id,
        },
        { new: true, session },
      )

      if (payment.modelType === PAYMENT_MODEL_TYPE.Order) {
        const order = await Order.findById(payment.reference).session(session)
        if (!order) {
          throw new AppError(httpStatus.NOT_FOUND, 'Order not found!')
        }

        let updateFields: Partial<TOrder> = {}

        // Handle initial payment
        if (payment.type === 'initial') {
          updateFields = {
            ...updateFields,
            initialPayment: {
              amountPaid: payment.amount,
              paidAt: new Date(),
              transactionId: payment.transactionId,
              status: PAYMENT_STATUS.completed,
            },
            initialPayCompleted: true,
            pendingAmount: order.totalAmount - payment.amount,
            status: ORDER_STATUS.running,
          }

          // Check if project already exists for this order
          const existingProject = await Project.findOne(
            { order: order._id, isDeleted: false },
            null,
            { session },
          )

          if (existingProject) {
            // Project already exists → just update received amount & status if needed
            await Project.findByIdAndUpdate(
              existingProject._id,
              {
                received: payment.amount, // add the initial payment
                status: PROJECT_STATUS.ongoing, // ensure it's ongoing
                updatedAt: new Date(),
              },
              { session },
            )
          } else {
            // No project yet → create new one
            await Project.create(
              [
                {
                  author: order.sender,
                  client: order.receiver,
                  order: order._id,
                  budget: order.totalAmount,
                  expense: 0,
                  received: payment.amount,
                  status: PROJECT_STATUS.ongoing,
                },
              ],
              { session },
            )
          }
        }
        // Handle final payment
        else if (payment.type === 'final') {
          updateFields = {
            ...updateFields,
            finalPayment: {
              amountPaid: payment.amount,
              paidAt: new Date(),
              transactionId: payment.transactionId,
              status: PAYMENT_STATUS.completed,
            },
            finalPayCompleted: true,
            isFullyPaid: true,
            pendingAmount: 0,
            status: ORDER_STATUS.completed,
            isCompleted: true,
            actualEndDate: new Date(),
          }
        }

        //  Update existing project received amount on final payment
        if (!order.isCompleted && order.status !== ORDER_STATUS.completed) {
        await Project.findOneAndUpdate(
          { order: order._id, isDeleted: false },
          {
            $inc: { received: payment.amount },
            status: PROJECT_STATUS.completed, // optional: mark project completed
            updatedAt: new Date(),
          },
          { session },
        )
        }

        await Order.findByIdAndUpdate(payment.reference, updateFields, {
          session,
        })
      } else if (payment.modelType === PAYMENT_MODEL_TYPE.Subscription) {
        // Your existing subscription logic...
        const subscription = await Subscription.findById(
          payment.reference,
        ).session(session)
        if (!subscription) {
          throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found!')
        }

        await Subscription.findByIdAndUpdate(
          payment.reference,
          {
            transactionId: payment.transactionId,
            paymentStatus: PAYMENT_STATUS.paid,
            status: 'confirmed',
          },
          { new: true, session },
        )

        await Package.findByIdAndUpdate(
          subscription.package,
          { $inc: { popularity: 1 } },
          { session },
        )

        const finalExpiryDate = subscription.expiredAt || new Date()
        await User.findByIdAndUpdate(
          payment.user,
          { $set: { packageExpiry: finalExpiryDate } },
          { session },
        )
      }

      // Send notifications (you can call your notify functions here)
      await paymentNotifyToUser('SUCCESS', payment)
      await paymentNotifyToAdmin('SUCCESS', payment)

      await session.commitTransaction()
      return result
    } catch (error: any) {
      await session.abortTransaction()
      attempt++
      if (attempt === maxRetries) {
        if (verifiedPaymentId) {
          try {
            await refundPaystackPayment(verifiedPaymentId)
          } catch (refundError: any) {
            console.error('Refund failed:', refundError.message)
          }
        }
        throw new AppError(httpStatus.BAD_GATEWAY, error.message)
      }
      console.warn(
        `Retrying transaction (attempt ${attempt + 1}/${maxRetries})`,
      )
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } finally {
      session.endSession()
    }
  }
}

const handleWebhook = async (req: any) => {
  const result = await handlePaystackWebhook(req)
  return result
}

const getAllPaymentsFromDB = async (query: Record<string, any>) => {
  const reviewsModel = new QueryBuilder(
    Payment.find().populate([
      { path: 'reference', select: 'user status paymentStatus' },
      { path: 'account', select: 'name email photoUrl contactNumber age' },
    ]),
    query,
  )
    .search([''])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await reviewsModel.modelQuery
  const meta = await reviewsModel.countTotal()

  return {
    data,
    meta,
  }
}

const getDashboardDataFromDB = async (query: Record<string, unknown>) => {}

const getAPaymentsFromDB = async (id: string) => {
  const payment = await Payment.findById(id).populate([
    { path: 'reference', select: 'user status paymentStatus' },
    { path: 'user', select: 'name email photoUrl contactNumber' },
  ])
  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not found!')
  }

  return payment
}

const getAPaymentByReferenceIdFromDB = async (referenceId: string) => {
  const payment = await Payment.findOne({ reference: referenceId }).populate([
    { path: 'reference', select: 'user status paymentStatus' },
    { path: 'user', select: 'name email photoUrl contactNumber' },
  ])
  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not found!')
  }

  return payment
}

const refundPayment = async (payload: any) => {
  if (!payload?.intendId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Payment intent ID is required')
  }

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const paymentData = await Payment.findOne({
      paymentIntentId: payload.intendId,
    }).session(session)
    if (!paymentData) {
      throw new AppError(httpStatus.NOT_FOUND, 'Payment record not found')
    }

    // Validate booking
    const booking = await Order.findById(paymentData.reference).session(session)

    if (!booking) {
      throw new AppError(httpStatus.NOT_FOUND, 'Booking record not found')
    }

    if (booking.status !== ORDER_STATUS.cancelled) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Only cancelled bookings can be refunded. Please cancel the booking first.',
      )
    }

    // Send refund request to Paystack
    const refundResponse = await refundPaystackPayment(
      Number(paymentData.paymentIntentId),
    )

    if (!refundResponse?.status) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Refund initiation failed at Paystack',
      )
    }

    // Update booking and payment status
    await Order.findByIdAndUpdate(
      paymentData.reference,
      { paymentStatus: PAYMENT_STATUS.refunded },
      { new: true, session },
    )

    const payment = await Payment.findOneAndUpdate(
      { paymentIntentId: payload.intendId },
      { status: PAYMENT_STATUS.refunded, isPaid: false },
      { new: true, session },
    )

    if (!payment) {
      throw new AppError(httpStatus.NOT_FOUND, 'Payment record not updated')
    }

    await paymentNotifyToUser('REFUND', payment)
    await paymentNotifyToAdmin('REFUND', payment)

    await session.commitTransaction()
    session.endSession()

    return refundResponse.data
  } catch (error: any) {
    await session.abortTransaction()
    session.endSession()
    console.error('Refund Error:', error)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      error.message || 'Refund processing failed',
    )
  }
}

export const PaymentService = {
  checkout,
  confirmPayment,
  handleWebhook,
  getAllPaymentsFromDB,
  getDashboardDataFromDB,
  getAPaymentsFromDB,
  getAPaymentByReferenceIdFromDB,
  refundPayment,
}
