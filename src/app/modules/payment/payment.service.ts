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
import { PAYMENT_STATUS, PAYMENT_TYPE } from './payment.constant'
import { TSubscriptions } from '../subscription/subscription.interface'
import { Subscription } from '../subscription/subscription.models'
import { User } from '../user/user.model'
import { Package } from '../package/package.model'
import { TOrder } from '../order/order.interface'
import { Order } from '../order/order.models'
import { ORDER_AUTHORITY, ORDER_STATUS } from '../order/order.constants'
import { Project } from '../project/project.models'
import { PROJECT_STATUS } from '../project/project.constants'
import {
  PARTICIPANT_ROLE,
  PARTICIPANT_STATUS,
} from '../participant/participant.constants'
import { Participant } from '../participant/participant.models'
import { Chat } from '../chat/chat.models'
import { CHAT_STATUS, CHAT_TYPE } from '../chat/chat.constants'
import { Withdraw } from '../withdraw/withdraw.model'
import {
  WITHDRAW_AUTHORITY,
  WITHDRAW_METHOD,
  WITHDRAW_STATUS,
} from '../withdraw/withdraw.constant'
import { SUBSCRIPTION_STATUS } from '../subscription/subscription.constants'
import dayjs from 'dayjs'

const checkout = async (payload: TPayment) => {
  const transactionId = generateTransactionId()
  const { modelType, user: userId, reference, type } = payload

  const session = await startSession()
  session.startTransaction()

  try {
    const user = await User.findById(userId).session(session)
    if (!user || user?.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
    }

    let order: TOrder | null = null
    let subscription: TSubscriptions | null = null

    // Fetch model
    if (modelType === PAYMENT_MODEL_TYPE.Order) {
      order = await Order.findOne({
        _id: reference,
        authority: ORDER_AUTHORITY.client,
        isDeleted: false,
      }).session(session)
      if (!order) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          'Order Not Found or this is not client order!',
        )
      }

      if (order.status !== ORDER_STATUS.pending) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Can make payment only pending order!',
        )
      }

      // Set author (receiver = vendor/planner who will earn)
      payload.author = order.receiver
    } else if (modelType === PAYMENT_MODEL_TYPE.Subscription) {
      subscription = await Subscription.findById(reference)
        .populate('package')
        .session(session)
      if (!subscription) {
        throw new AppError(httpStatus.NOT_FOUND, 'Subscription Not Found!')
      }
    } else {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid model type')
    }

    // ── Prevent duplicate payment for completed steps ──
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
    }).session(session)

    let finalAmount: number

    if (paymentData) {
      // Reuse existing unpaid payment
      paymentData = await Payment.findByIdAndUpdate(
        paymentData._id,
        { transactionId },
        { new: true, session },
      )
      finalAmount = paymentData!.amount
    } else {
      // Create new payment
      payload.transactionId = transactionId

      // Set correct amount based on payment type
      if (modelType === PAYMENT_MODEL_TYPE.Order && order) {
        finalAmount =
          type === 'initial' ? order.initialAmount : order.pendingAmount
      } else {
        // @ts-ignore
        finalAmount = subscription?.amount
      }

      payload.amount = finalAmount

      // ── COMMISSION LOGIC ── only for Order payments
      let platformEarning = 0
      let authorEarning = finalAmount

      if (modelType === PAYMENT_MODEL_TYPE.Order) {
        const PLATFORM_COMMISSION_RATE = 0.03 // 3%
        platformEarning = Math.round(finalAmount * PLATFORM_COMMISSION_RATE)
        authorEarning = finalAmount - platformEarning
      }

      payload.platformEarning = platformEarning
      payload.authorEarning = authorEarning

      // Create payment
      const createdPayments = await Payment.create([payload], { session })
      paymentData = createdPayments[0]

      if (!paymentData) {
        throw new AppError(
          httpStatus.INTERNAL_SERVER_ERROR,
          'Failed to create payment',
        )
      }
    }

    // Handle Subscription checkout
    if (subscription) {
      const checkoutUrl = await createPaystackSubscriptionCheckout({
        userId,
        packageId: reference,
        paymentId: paymentData!._id,
      })

      await session.commitTransaction()
      return checkoutUrl
    }

    // Handle Order checkout
    if (order) {
      const checkoutSessionUrl = await createPaystackCheckoutSession({
        product: {
          amount: paymentData!.amount,
          name: `Order ${type === 'initial' ? 'Initial' : 'Final'} Payment - ${order.title}`,
          quantity: 1,
        },
        customer: {
          name: user?.name || '',
          email: user?.email || '',
        },
        paymentId: paymentData!._id,
      })

      await session.commitTransaction()
      return checkoutSessionUrl
    }

    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Unexpected model type',
    )
  } catch (error: any) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
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
        if (payment.type === PAYMENT_TYPE.initial) {
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

          // Check if project already exists
          let project = await Project.findOne(
            { order: order._id, isDeleted: false },
            null,
            { session },
          )

          if (!project) {
            // Create new project
            ;[project] = await Project.create(
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
          } else {
            // Update existing project received amount
            await Project.findByIdAndUpdate(
              project._id,
              {
                $inc: { received: payment.amount },
                status: PROJECT_STATUS.ongoing,
                updatedAt: new Date(),
              },
              { session },
            )
          }

          // ──────────────────────────────────────────────
          // AUTO CREATE / CHECK ORDER CHAT (duplicate-proof)
          // ──────────────────────────────────────────────
          let orderChat = await Chat.findOne({
            order: order._id,
            type: CHAT_TYPE.order,
            isDeleted: false,
          }).session(session)

          if (!orderChat) {
            ;[orderChat] = await Chat.create(
              [
                {
                  order: order._id,
                  type: CHAT_TYPE.order,
                  name: `Order Chat - ${order.title}`,
                  status: CHAT_STATUS.active,
                  isDeleted: false,
                },
              ],
              { session },
            )

            // Add participants (planner & client)
            const participants = [
              { user: order.sender, role: PARTICIPANT_ROLE.planer },
              { user: order.receiver, role: PARTICIPANT_ROLE.user },
            ]

            const existingParticipants = await Participant.find({
              chat: orderChat._id,
              isDeleted: false,
            }).session(session)

            const existingUserIds = new Set(
              existingParticipants.map((p) => p.user.toString()),
            )

            const newParticipants = participants.filter(
              (p) => !existingUserIds.has(p.user.toString()),
            )

            if (newParticipants.length > 0) {
              await Participant.insertMany(
                newParticipants.map((p) => ({
                  chat: orderChat!._id,
                  user: p.user,
                  role: p.role,
                  status: PARTICIPANT_STATUS.active,
                })),
                { session },
              )
            }
          }

          // ──────────────────────────────────────────────
          // AUTO CREATE / CHECK GROUP CHAT (duplicate-proof)
          // ──────────────────────────────────────────────
          let groupChat = await Chat.findOne({
            project: project._id,
            type: CHAT_TYPE.group,
            isDeleted: false,
          }).session(session)

          if (!groupChat) {
            ;[groupChat] = await Chat.create(
              [
                {
                  project: project._id,
                  type: CHAT_TYPE.group,
                  name: `Project Group - ${order.title}`,
                  status: CHAT_STATUS.active,
                  isDeleted: false,
                },
              ],
              { session },
            )

            // Add initial participant (planner/author)
            const existingGroupParticipants = await Participant.find({
              chat: groupChat._id,
              isDeleted: false,
            }).session(session)

            const existingGroupIds = new Set(
              existingGroupParticipants.map((p) => p.user.toString()),
            )

            if (!existingGroupIds.has(order.sender.toString())) {
              await Participant.create(
                [
                  {
                    chat: groupChat._id,
                    user: order.sender,
                    role: PARTICIPANT_ROLE.planer,
                    status: PARTICIPANT_STATUS.active,
                  },
                ],
                { session },
              )
            }
          }
        }
        // Handle final payment
        else if (payment.type === PAYMENT_TYPE.final) {
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

        // ── NEW: Transfer authorEarning to author's balance ──
        if (payment.author) {
          const author = await User.findById(payment.author).session(session)
          if (author) {
            await User.findByIdAndUpdate(
              payment.author,
              {
                $inc: { balance: payment.authorEarning },
              },
              { session },
            )

            console.log(
              `Transferred ₦${payment.authorEarning} to author ${payment.author} balance`,
            )
          } else {
            console.warn(
              `Author ${payment.author} not found for payment ${paymentId}`,
            )
          }
        }

        // ──────────────────────────────────────────────
        // NEW: Create Withdraw Request for Author (planner) when order payment succeeds
        // Only for authority: 'client' (planner receives money from client)
        // ──────────────────────────────────────────────
        if (payment.author && order.authority === ORDER_AUTHORITY.client) {
          // Duplicate check by payment._id
          const existingWithdraw = await Withdraw.findOne({
            user: payment.author,
            reference: payment._id,
            order: order._id,
          }).session(session)

          if (!existingWithdraw) {
            const now = new Date()
            const proceedAtDate = dayjs(now).add(3, 'day').toDate()

            await Withdraw.create(
              [
                {
                  user: payment.author,
                  authority: WITHDRAW_AUTHORITY.planer,
                  method: WITHDRAW_METHOD.playstack,
                  amount: payment.authorEarning,
                  reference: payment._id,
                  order: order._id,
                  proceedAt: proceedAtDate,
                },
              ],
              { session },
            )

            console.log(
              `Withdraw request created for payment ${payment._id} → ₦${payment.authorEarning}`,
            )
          } else {
            console.log(
              `Withdraw already exists for payment ${payment._id} - skipping`,
            )
          }
        }
      } else if (payment.modelType === PAYMENT_MODEL_TYPE.Subscription) {
        const subscription = await Subscription.findById(
          payment.reference,
        ).session(session)
        if (!subscription) {
          throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found!')
        }

        // Update subscription
        await Subscription.findByIdAndUpdate(
          payment.reference,
          {
            transactionId: payment.transactionId,
            paymentStatus: PAYMENT_STATUS.paid,
            status: SUBSCRIPTION_STATUS.active,
          },
          { new: true, session },
        )

        // Update package popularity
        await Package.findByIdAndUpdate(
          subscription.package,
          { $inc: { popularity: 1 } },
          { session },
        )

        // Subscription Management: Extend or Replace
        const now = new Date()

        const previousSubscription = await Subscription.findOne({
          user: subscription.user,
          _id: { $ne: subscription._id },
          paymentStatus: PAYMENT_STATUS.paid,
          status: SUBSCRIPTION_STATUS.active,
        }).session(session)

        if (previousSubscription) {
          if (
            previousSubscription.expiredAt &&
            previousSubscription.expiredAt > now
          ) {
            // Extend existing subscription
            if (subscription.expiredAt) {
              previousSubscription.expiredAt = new Date(
                previousSubscription.expiredAt.getTime() +
                  (subscription.expiredAt.getTime() - now.getTime()),
              )
            }
          } else {
            // Replace expiry
            if (subscription.expiredAt) {
              previousSubscription.expiredAt = subscription.expiredAt
            }
            previousSubscription.isExpired = false
          }

          await previousSubscription.save({ session })

          // Point payment to previous subscription and delete new one
          await Payment.findByIdAndUpdate(
            paymentId,
            {
              subscription: previousSubscription._id,
            },
            { session },
          )

          await Subscription.findByIdAndDelete(subscription._id, { session })
        }

        // Update user's package expiry
        const finalExpiryDate = subscription.expiredAt || new Date()
        await User.findByIdAndUpdate(
          payment.user,
          { packageExpiry: finalExpiryDate },
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
            await refundPaystackPayment(
              verifiedPaymentId,
              paymentId.amount,
              'Refund Request',
            )
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
  // 1. totalRevenue: Sum of all paid amounts
  const totalRevenueResult = await Payment.aggregate([
    {
      $match: {
        status: PAYMENT_STATUS.paid,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
      },
    },
  ])
  const totalRevenue = totalRevenueResult[0]?.totalRevenue || 0

  // 2. commission: Sum of all platformEarning from paid payments
  const commissionResult = await Payment.aggregate([
    {
      $match: {
        status: PAYMENT_STATUS.paid,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        commission: { $sum: '$platformEarning' },
      },
    },
  ])
  const commission = commissionResult[0]?.commission || 0

  // 3. pendingPayout: Sum of all pending withdrawal amounts
  const pendingPayoutResult = await Withdraw.aggregate([
    {
      $match: {
        status: WITHDRAW_STATUS.proceed,
      },
    },
    {
      $group: {
        _id: null,
        pendingPayout: { $sum: '$amount' },
      },
    },
  ])
  const pendingPayout = pendingPayoutResult[0]?.pendingPayout || 0

  const paymentModel = new QueryBuilder(
    Payment.find({
      status: { $ne: PAYMENT_STATUS.unpaid },
      isDeleted: false,
    }).populate([{ path: 'user', select: 'name email photoUrl' }]),
    query,
  )
    .search([''])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await paymentModel.modelQuery
  const meta = await paymentModel.countTotal()

  return {
    meta,
    data: {
      totalRevenue,
      commission,
      pendingPayout,
      paymentList: data,
    },
  }
}

const getDashboardDataFromDB = async (query: Record<string, unknown>) => {}

const getAPaymentsFromDB = async (id: string) => {
  const payment = await Payment.findById(id).populate([
    { path: 'reference' },
    { path: 'user', select: 'name email photoUrl contactNumber address' },
  ])
  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not found!')
  }

  return payment
}

const getAPaymentByReferenceIdFromDB = async (referenceId: string) => {
  const payment = await Payment.findOne({ reference: referenceId }).populate([
    { path: 'reference' },
    { path: 'user', select: 'name email photoUrl contactNumber address' },
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
      booking.totalAmount,
      payload.reason,
    )
    if (!refundResponse.success) {
      if (refundResponse.alreadyRefunded) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Transaction already fully refunded',
        )
      }
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Paystack refund failed',
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

    return refundResponse
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
