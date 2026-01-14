import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { PAYMENT_MODEL_TYPE, TPayment } from './payment.interface'
import { Payment } from './payment.model'
import {
  cancelPaystackSubscription,
  createPaystackCheckoutSession,
  createPaystackSubscriptionCheckout,
  enablePaystackSubscription,
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
import { NotificationService } from '../notification/notification.service'
import { messages } from '../notification/notification.constant'
import { modeType } from '../notification/notification.interface'
import { TOrder } from '../order/order.interface'
import { Order } from '../order/order.models'
import { ORDER_STATUS } from '../order/order.constants'

const checkout = async (payload: TPayment) => {
  const transactionId = generateTransactionId()
  const { modelType, user: userId, reference } = payload

  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  let model: TSubscriptions | TOrder | null = null
  let modelName

  // Determine model type and fetch associated data
  if (modelType === 'Order') {
    model = await Order.findById(reference)
    modelName = 'Order'
  } else if (modelType === 'Subscription') {
    model = await Subscription.findById(reference).populate('package')
    modelName = 'Subscription'
  }

  if (!model) {
    throw new AppError(httpStatus.NOT_FOUND, `${modelName} Not Found!`)
  }

  // Check for existing unpaid payment
  let paymentData = await Payment.findOne({ reference, isPaid: false, user })

  if (paymentData) {
    paymentData = await Payment.findByIdAndUpdate(
      paymentData._id,
      { transactionId },
      { new: true },
    )
  } else {
    payload.transactionId = transactionId
    // @ts-ignore
    payload.amount = model.amount
    paymentData = await Payment.create(payload)
  }

  if (!paymentData) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create payment',
    )
  }

  if (modelType === 'Subscription') {
    return await createPaystackSubscriptionCheckout({
      userId,
      packageId: reference,
      paymentId: paymentData._id,
    })
  }

  const checkoutSessionUrl = await createPaystackCheckoutSession({
    product: {
      amount: paymentData.amount,
      name:
        // @ts-ignore
        modelType === PAYMENT_MODEL_TYPE.Subscription
          ? // @ts-ignore
            model?.package?.title
          : 'Order Payment',
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
      if (payment.modelType === 'Subscription') {
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

      await Payment.findByIdAndUpdate(
        paymentId,
        {
          isPaid: true,
          status: PAYMENT_STATUS.paid,
          paymentIntentId: verification.data.id,
        },
        { new: true, session },
      )

      if (payment?.modelType === 'Order') {
        await Order.findOneAndUpdate(
          payment?.reference,
          {
            transactionId: payment?.transactionId,
            paymentStatus: PAYMENT_STATUS.paid,
            status: 'processing',
          },
          { session },
        )
      } else if (payment?.modelType === 'Subscription') {
        const subscription = await Subscription.findById(
          payment.reference,
        ).session(session)
        if (!subscription) {
          throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found!')
        }

        const newSubscription = await Subscription.findByIdAndUpdate(
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
          { new: true, session },
        )

        const finalExpiryDate = newSubscription?.expiredAt || new Date()
        await User.findByIdAndUpdate(
          { _id: payment.user },
          { $set: { packageExpiry: finalExpiryDate } },
          { new: true, session },
        )
      } else {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Invalid model type for payment processing!',
        )
      }

      await paymentNotifyToUser('SUCCESS', payment)
      await paymentNotifyToAdmin('SUCCESS', payment)

      await session.commitTransaction()
      return payment
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
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait before retry
    } finally {
      session.endSession()
    }
  }
}

const cancelSubscription = async (subscriptionId: string, userId: string) => {
  const subscription = await Subscription.findById(subscriptionId)
  if (!subscription) {
    throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found!')
  }

  if (subscription.user.toString() !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not authorized to cancel this subscription!',
    )
  }

  if (subscription.status === 'cancelled') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Subscription is already cancelled!',
    )
  }

  if (!subscription.subscriptionCode) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Subscription code is missing!')
  }

  if (!subscription.emailToken) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Email token is missing for this subscription!',
    )
  }

  await cancelPaystackSubscription(
    subscription.subscriptionCode,
    subscription.emailToken,
  )

  // Update subscription status in the database
  const updatedSubscription = await Subscription.findByIdAndUpdate(
    subscriptionId,
    {
      autoRenew: 'disabled',
    },
    { new: true },
  )
  console.log({ updatedSubscription })

  // Notify user
  await NotificationService.createNotificationIntoDB({
    receiver: userId,
    message: messages.subscription.cancelled,
    description: `Your subscription (${subscription.subscriptionCode}) has been cancelled successfully.`,
    reference: subscriptionId,
    model_type: modeType.Subscription,
  })

  return updatedSubscription
}

const enableSubscription = async (subscriptionId: string, userId: string) => {
  const subscription = await Subscription.findById(subscriptionId)
  if (!subscription) {
    throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found!')
  }

  if (subscription.user.toString() !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not authorized to cancel this subscription!',
    )
  }

  if (!subscription.subscriptionCode) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Subscription code is missing!')
  }

  if (!subscription.emailToken) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Email token is missing for this subscription!',
    )
  }

  const result = await enablePaystackSubscription(
    subscription.subscriptionCode,
    subscription.emailToken,
  )

  if (result.authorizationUrl) {
    // Return authorization URL for redirect
    return {
      status: 'pending',
      message: 'Please complete the payment to enable auto-renew.',
      authorizationUrl: result.authorizationUrl,
    }
  }

  // Update subscription status in the database
  const updatedSubscription = await Subscription.findByIdAndUpdate(
    subscriptionId,
    {
      autoRenew: 'active',
      status: 'active',
      isExpired: false,
    },
    { new: true },
  )

  // Notify user
  await NotificationService.createNotificationIntoDB({
    receiver: userId,
    message: messages.subscription.cancelled,
    description: `Your subscription (${subscription.subscriptionCode}) has been cancelled successfully.`,
    reference: subscriptionId,
    model_type: modeType.Subscription,
  })

  return updatedSubscription
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
  cancelSubscription,
  enableSubscription,
  handleWebhook,
  getAllPaymentsFromDB,
  getDashboardDataFromDB,
  getAPaymentsFromDB,
  getAPaymentByReferenceIdFromDB,
  refundPayment,
}
