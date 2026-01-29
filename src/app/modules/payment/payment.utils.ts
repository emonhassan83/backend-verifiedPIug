import config from '../../config'
import { messages } from '../notification/notification.constant'
import { modeType } from '../notification/notification.interface'
import { PAYMENT_MODEL_TYPE, TPayment } from './payment.interface'
import { NotificationService } from '../notification/notification.service'
import { findAdmin } from '../../utils/findAdmin'
//@ts-ignore
import Paystack from 'paystack-api'
import axios from 'axios'
import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import { User } from '../user/user.model'
import { Package } from '../package/package.model'
import { Subscription } from '../subscription/subscription.models'
import { Payment } from './payment.model'
import { startSession, Types } from 'mongoose'
import * as crypto from 'crypto'
import { PAYMENT_STATUS } from './payment.constant'
import { sendNotification } from '../../utils/sentNotification'
import { SUBSCRIPTION_STATUS } from '../subscription/subscription.constants'

export const paystack = Paystack(config.paystack.secret_key)

interface TPayload {
  product: {
    amount: number
    name: string
    quantity: number
  }
  paymentId: string
  customer: {
    name: string
    email: string
  }
}

interface TSubscriptionPayload {
  userId: Types.ObjectId | string
  packageId: Types.ObjectId | string
  paymentId: Types.ObjectId | string
}

// Initialize subscription checkout
export const createPaystackSubscriptionCheckout = async (
  payload: TSubscriptionPayload,
) => {
  const { userId, packageId, paymentId } = payload

  const user = await User.findById(userId)
  if (!user || user.isDeleted || user.status === 'blocked') {
    throw new AppError(
      user ? httpStatus.FORBIDDEN : httpStatus.NOT_FOUND,
      user ? 'User is deleted or blocked' : 'User not found',
    )
  }

  const sub = await Subscription.findById(packageId).select('package')
  if (!sub || sub?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found')
  }

  const pkg = await Package.findById(sub.package)
  if (!pkg) {
    throw new AppError(httpStatus.NOT_FOUND, 'Package not found')
  }

  const response = await paystack.transaction.initialize({
    email: user.email,
    amount: pkg.price * 100, // Convert to kobo
    plan: pkg.planCode,
    metadata: {
      name: user.name,
      paymentId,
      product: pkg.title,
      packageId: pkg._id,
    },
    callback_url: `${config.server_url}/payments/confirm-payment?paymentId=${paymentId}`,
  })
  if (!response.status) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to initialize subscription',
    )
  }

  return response.data.authorization_url
}

// Verify subscription
export const verifyPaystackSubscription = async (reference: string) => {
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${config.paystack.secret_key}`,
          'Content-Type': 'application/json',
        },
      },
    )

    const { status, data } = response.data
    if (!status || data.status !== 'success') {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Subscription verification failed',
      )
    }

    return response.data
  } catch (error: any) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error?.response?.data?.message || 'Subscription verification failed',
    )
  }
}

export const handlePaystackWebhook = async (req: any) => {
  console.log('Received webhook:', JSON.stringify(req.body, null, 2))

  const signature = req.headers['x-paystack-signature']
  const secret = config.paystack.secret_key as string

  const hash = crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(req.body))
    .digest('hex')

  if (hash !== signature) {
    console.error('Invalid webhook signature')
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid webhook signature')
  }

  const event = req.body
  const session = await startSession()

  try {
    await session.startTransaction()

    switch (event.event) {
      // ──────────────────────────────────────────────
      // ১. চার্জ সফল হলে (পেমেন্ট সম্পন্ন)
      // ──────────────────────────────────────────────
      case 'charge.success': {
        const { amount, paid_at, reference, metadata, customer, plan } =
          event.data
        console.log(
          `[charge.success] ref: ${reference} | email: ${customer.email} | amount: ${amount}`,
        )

        const user = await User.findOne({ email: customer.email }).session(
          session,
        )
        if (!user) {
          throw new AppError(
            httpStatus.NOT_FOUND,
            `User not found: ${customer.email}`,
          )
        }

        // সাবস্ক্রিপশন খোঁজা — transactionId দিয়ে সবচেয়ে নিরাপদ
        let subscription = await Subscription.findOne({
          user: user._id,
          transactionId: reference,
          isDeleted: false,
        }).session(session)

        // ফলব্যাক: সাম্প্রতিক pending/paid সাবস্ক্রিপশন
        if (!subscription) {
          subscription = await Subscription.findOne({
            user: user._id,
            paymentStatus: {
              $in: [PAYMENT_STATUS.unpaid, PAYMENT_STATUS.paid],
            },
            createdAt: { $gte: new Date(Date.now() - 20 * 60 * 1000) },
            isDeleted: false,
          }).session(session)
        }

        if (!subscription) {
          console.warn(`No subscription found for transaction: ${reference}`)
          throw new AppError(
            httpStatus.NOT_FOUND,
            'No matching subscription found for this payment',
          )
        }

        // পেমেন্ট আপডেট
        const payment = await Payment.findOne({
          transactionId: reference,
        }).session(session)
        if (payment) {
          await Payment.findByIdAndUpdate(
            payment._id,
            {
              isPaid: true,
              status: PAYMENT_STATUS.paid,
              paymentIntentId: event.data.id,
              amount: amount / 100,
            },
            { session, new: true },
          )
          await paymentNotifyToUser('SUCCESS', payment)
        } else {
          const newPayment = await Payment.create(
            [
              {
                transactionId: reference,
                amount: amount / 100,
                isPaid: true,
                status: PAYMENT_STATUS.paid,
                paymentIntentId: event.data.id,
                account: subscription.user,
                reference: subscription._id,
                modelType: PAYMENT_MODEL_TYPE.Subscription,
              },
            ],
            { session },
          )
          await paymentNotifyToUser('SUCCESS', newPayment[0])
        }

        // সাবস্ক্রিপশন আপডেট
        const interval = plan.interval === 'annually' ? 12 : 1
        await Subscription.findByIdAndUpdate(
          subscription._id,
          {
            paymentStatus: 'paid',
            expiredAt: new Date(
              new Date(paid_at).setMonth(
                new Date(paid_at).getMonth() + interval,
              ),
            ),
            isExpired: false,
            status: 'active',
            autoRenew: true,
          },
          { session, new: true },
        )

        await User.findByIdAndUpdate(
          user._id,
          {
            packageExpiry: new Date(
              new Date(paid_at).setMonth(
                new Date(paid_at).getMonth() + interval,
              ),
            ),
          },
          { session },
        )

        const notifyPayload = {
          receiver: user._id,
          message: messages.subscription.newPlan,
          description: `Your ${plan.name} subscription has been activated.`,
          reference: subscription._id,
          model_type: modeType.Subscription,
        }

        if (user?.fcmToken) {
          await sendNotification([user.fcmToken], notifyPayload)
        }

        break
      }

      // ──────────────────────────────────────────────
      // ২. সাবস্ক্রিপশন তৈরি হয়েছে (এখানেই subscription_code + email_token আসে)
      // ──────────────────────────────────────────────
      case 'subscription.create': {
        const { subscription_code, email_token, customer, plan } = event.data
        console.log(
          `[subscription.create] code: ${subscription_code} | email: ${customer.email} | plan: ${plan.plan_code}`,
        )

        const user = await User.findOne({ email: customer.email }).session(
          session,
        )
        if (!user) {
          throw new AppError(
            httpStatus.NOT_FOUND,
            `User not found: ${customer.email}`,
          )
        }

        // সবচেয়ে নির্ভরযোগ্য উপায়: সাম্প্রতিক paid সাবস্ক্রিপশন খোঁজা
        let subscription = await Subscription.findOne({
          user: user._id,
          paymentStatus: PAYMENT_STATUS.paid,
          isDeleted: false,
          createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }, // ৩০ মিনিটের মধ্যে
        }).session(session)

        // যদি না পাওয়া যায় তাহলে সবচেয়ে নতুন সাবস্ক্রিপশন নেওয়া
        if (!subscription) {
          subscription = await Subscription.findOne({
            user: user._id,
            isDeleted: false,
          })
            .sort({ createdAt: -1 })
            .session(session)
        }

        if (!subscription) {
          console.warn(
            `No subscription found to associate for user ${user._id}`,
          )
          throw new AppError(
            httpStatus.NOT_FOUND,
            'No subscription found to associate with this webhook',
          )
        }

        // আপডেট
        await Subscription.findByIdAndUpdate(
          subscription._id,
          {
            subscriptionCode: subscription_code,
            emailToken: email_token,
            status: SUBSCRIPTION_STATUS.active,
            createdAt: new Date(event.data.createdAt),
            autoRenew: true,
          },
          { session, new: true },
        )

        const notifyPayload = {
          receiver: user._id,
          message: messages.subscription.newPlan,
          description: `Your ${plan.name} subscription has been activated with code ${subscription_code}.`,
          reference: subscription._id,
          model_type: modeType.Subscription,
        }

        if (user?.fcmToken) {
          await sendNotification([user.fcmToken], notifyPayload)
        }

        break
      }

      // ──────────────────────────────────────────────
      // ৩. পরবর্তী ইনভয়েস তৈরি হয়েছে
      // ──────────────────────────────────────────────
      case 'invoice.create': {
        const { subscription_code, amount, due_date } = event.data
        console.log(
          `[invoice.create] subscription: ${subscription_code} | amount: ${amount}`,
        )

        const subscription = await Subscription.findOne({
          subscriptionCode: subscription_code,
        }).session(session)

        const user = await User.findById(subscription?.user).session(session)
        if (!user) {
          throw new AppError(
            httpStatus.NOT_FOUND,
            `User not found for subscription: ${subscription_code}`,
          )
        }

        if (subscription && user) {
          const notifyPayload = {
            receiver: subscription.user,
            message: messages.paymentManagement.upcomingCharge,
            description: `Your subscription will be charged ₦${amount / 100} on ${new Date(due_date).toLocaleDateString()}.`,
            reference: subscription._id,
            model_type: modeType.Subscription,
          }

          await sendNotification([user.fcmToken], notifyPayload)
        } else {
          console.warn(`Subscription not found: ${subscription_code}`)
        }
        break
      }

      // ──────────────────────────────────────────────
      // ৪. সাবস্ক্রিপশন ডিসেবল হয়েছে (auto-renew বন্ধ)
      // ──────────────────────────────────────────────
      case 'subscription.disable': {
        const { subscription_code } = event.data
        console.log(`[subscription.disable] code: ${subscription_code}`)

        const subscription = await Subscription.findOne({
          subscriptionCode: subscription_code,
        }).session(session)

        const user = await User.findById(subscription?.user).session(session)
        if (!user) {
          throw new AppError(
            httpStatus.NOT_FOUND,
            `User not found for subscription: ${subscription_code}`,
          )
        }

        if (subscription && user) {
          await Subscription.findByIdAndUpdate(
            subscription._id,
            {
              status: SUBSCRIPTION_STATUS.cancelled,
              autoRenew: false,
              isExpired: true,
            },
            { session },
          )

          const notifyPayload = {
            receiver: subscription.user,
            message: messages.subscription.cancelled,
            description: `Your subscription ${subscription_code} auto-renew has been disabled.`,
            reference: subscription._id,
            model_type: modeType.Subscription,
          }

          await sendNotification([user.fcmToken], notifyPayload)

          const admin = await findAdmin()
          if (admin && admin.fcmToken) {
            const notifyPayload = {
              receiver: admin._id,
              message: messages.subscription.cancelled,
              description: `Subscription ${subscription_code} auto-renew disabled for user ${subscription.user}.`,
              reference: subscription._id,
              model_type: modeType.Subscription,
            }
            await sendNotification([admin.fcmToken], notifyPayload)
          }
        } else {
          console.warn(`Subscription not found: ${subscription_code}`)
        }
        break
      }

      // ──────────────────────────────────────────────
      // ৫. রিফান্ড প্রসেসড
      // ──────────────────────────────────────────────
      case 'refund.processed': {
        const { transaction_reference, amount, customer } = event.data
        console.log(
          `[refund.processed] ref: ${transaction_reference} | amount: ${amount}`,
        )

        const payment = await Payment.findOne({
          transactionId: transaction_reference,
        }).session(session)

        const user = await User.findOne({ email: customer.email }).session(
          session,
        )
        if (!user) {
          throw new AppError(
            httpStatus.NOT_FOUND,
            `User not found: ${customer.email}`,
          )
        }

        if (payment && user) {
          await Payment.findByIdAndUpdate(
            payment._id,
            {
              status: PAYMENT_STATUS.refunded,
              isPaid: false,
            },
            { session },
          )

          const notifyPayload = {
            receiver: payment.user,
            message: messages.paymentManagement.paymentRefunded,
            description: `A refund of ₦${amount / 100} has been processed for transaction ${transaction_reference}.`,
            reference: payment._id,
            model_type: modeType.Payment,
          }

          await sendNotification([user.fcmToken], notifyPayload)

          const admin = await findAdmin()
          if (admin && admin.fcmToken) {
            const notifyPayload = {
              receiver: admin._id,
              message: messages.paymentManagement.paymentRefunded,
              description: `A refund of ₦${amount / 100} has been processed for transaction ${transaction_reference}.`,
              reference: payment._id,
              model_type: modeType.Payment,
            }

            await sendNotification([admin.fcmToken], notifyPayload)
          }
        }
        break
      }

      // ──────────────────────────────────────────────
      // ৬. ইনভয়েস পেমেন্ট ফেল হয়েছে
      // ──────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const { subscription_code, amount, customer } = event.data
        console.log(
          `[invoice.payment_failed] subscription: ${subscription_code} | amount: ${amount}`,
        )

        const subscription = await Subscription.findOne({
          subscriptionCode: subscription_code,
        }).session(session)

        const user = await User.findById(subscription?.user).session(session)
        if (!user) {
          throw new AppError(
            httpStatus.NOT_FOUND,
            `User not found for subscription: ${subscription_code}`,
          )
        }

        if (subscription && user) {
          await Subscription.findByIdAndUpdate(
            subscription._id,
            {
              paymentStatus: PAYMENT_STATUS.failed,
              status: SUBSCRIPTION_STATUS.pending,
            },
            { session },
          )

          const manageLink =
            await getSubscriptionManagementLink(subscription_code)

          const notifyPayload = {
            receiver: subscription.user,
            message: messages.paymentManagement.paymentFailed,
            description: `Your subscription payment of ₦${amount / 100} failed. Update payment method: ${manageLink}`,
            reference: subscription._id,
            model_type: modeType.Subscription,
          }

          await sendNotification([user.fcmToken], notifyPayload)

          const admin = await findAdmin()
          if (admin && admin.fcmToken) {
            const notifyPayload = {
              receiver: admin._id,
              message: messages.paymentManagement.paymentFailed,
              description: `Subscription payment of ₦${amount / 100} failed for user ${customer.email}.`,
              reference: subscription._id,
              model_type: modeType.Subscription,
            }

            await sendNotification([user.fcmToken], notifyPayload)
          }
        }
        break
      }

      default:
        console.log('Unhandled webhook event:', event.event)
    }

    await session.commitTransaction()
    return { status: 'success' }
  } catch (error: any) {
    await session.abortTransaction()
    console.error('Webhook processing error:', error.message)
    return { status: 'error', message: error.message }
  } finally {
    session.endSession()
  }
}

// Generate subscription management link
export const getSubscriptionManagementLink = async (
  subscriptionCode: string,
) => {
  try {
    const response = await axios.get(
      `https://api.paystack.co/subscription/${subscriptionCode}`,
      {
        headers: {
          Authorization: `Bearer ${config.paystack.secret_key}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!response.data.status) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Failed to fetch subscription',
      )
    }

    return response.data.data.customer.manage_subscription_link
  } catch (error: any) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error?.response?.data?.message || 'Failed to get management link',
    )
  }
}

// Cancel Paystack subscription
export const cancelPaystackSubscription = async (
  subscriptionCode: string,
  emailToken: string,
) => {
  try {
    const subscription = await Subscription.findOne({ subscriptionCode })
    if (!subscription) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        `Subscription not found for code ${subscriptionCode}`,
      )
    }

    const response = await axios.post(
      'https://api.paystack.co/subscription/disable',
      { code: subscriptionCode, token: emailToken },
      {
        headers: {
          Authorization: `Bearer ${config.paystack.secret_key}`,
          'Content-Type': 'application/json',
        },
      },
    )

    console.log({ response })

    if (response.data.status) {
      const isExpired =
        subscription.expiredAt && subscription.expiredAt < new Date()
      await Subscription.findByIdAndUpdate(
        subscription._id,
        {
          autoRenew: 'disabled',
          status: isExpired ? 'cancelled' : 'active',
          isExpired: isExpired,
        },
        { new: true },
      )

      await NotificationService.createNotificationIntoDB({
        receiver: subscription.user,
        message: messages.subscription.cancelled,
        description: `Your subscription auto-renew has been disabled. You can still access premium features until ${subscription.expiredAt?.toLocaleDateString()}.`,
        reference: subscription._id,
        model_type: modeType.Subscription,
      })

      return {
        status: 'success',
        message: 'Subscription auto-renew disabled successfully',
      }
    } else {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        response.data.message || 'Failed to disable subscription',
      )
    }
  } catch (error: any) {
    console.error(
      `Error disabling subscription ${subscriptionCode}: ${error?.response?.data?.message || error.message}`,
    )
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error?.response?.data?.message || 'Failed to disable subscription',
    )
  }
}

// Enable Paystack subscription (auto-renew on)
export const enablePaystackSubscription = async (
  subscriptionCode: string,
  emailToken: string,
) => {
  try {
    const subscription = await Subscription.findOne({ subscriptionCode })
    if (!subscription) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        `Subscription not found for code ${subscriptionCode}`,
      )
    }

    const user = await User.findById(subscription.user)
    if (!user) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        `User not found for ID: ${subscription.user}`,
      )
    }

    const packageData = await Package.findById(subscription.package)
    if (!packageData) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        `Package not found for ID: ${subscription.package}`,
      )
    }

    // Check if subscription is expired
    const isExpired =
      subscription.expiredAt && subscription.expiredAt < new Date()
    if (isExpired) {
      // If expired or cancelled, initiate a new payment to reactivate
      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          email: user.email,
          amount: packageData.price * 100, // Convert to kobo
          metadata: {
            packageId: subscription.package,
            userId: subscription.user,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${config.paystack.secret_key}`,
            'Content-Type': 'application/json',
          },
        },
      )

      if (response.data.status) {
        return {
          status: 'success',
          message:
            'Subscription is expired or cancelled. A new payment has been initialized to enable auto-renew.',
          authorizationUrl: response.data.data.authorization_url,
        }
      } else {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          response.data.message || 'Failed to initialize payment',
        )
      }
    }

    try {
      const response = await axios.post(
        'https://api.paystack.co/subscription/enable',
        { code: subscriptionCode, token: emailToken },
        {
          headers: {
            Authorization: `Bearer ${config.paystack.secret_key}`,
            'Content-Type': 'application/json',
          },
        },
      )

      if (response.data.status) {
        await Subscription.findByIdAndUpdate(
          subscription._id,
          {
            autoRenew: 'active',
            status: 'active',
            isExpired: false,
          },
          { new: true },
        )

        await NotificationService.createNotificationIntoDB({
          receiver: subscription.user,
          message: messages.subscription.newPlan,
          description: `Your subscription auto-renew has been enabled.`,
          reference: subscription._id,
          model_type: modeType.Subscription,
        })

        return {
          status: 'success',
          message: 'Subscription auto-renew enabled successfully',
        }
      } else {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          response.data.message || 'Failed to enable subscription',
        )
      }
    } catch (error: any) {
      if (error?.response?.data?.message?.includes('cannot be reactivated')) {
        // If Paystack says "cannot be reactivated", initiate a new payment
        const paymentResponse = await axios.post(
          'https://api.paystack.co/transaction/initialize',
          {
            email: user.email,
            amount: packageData.price * 100, // Convert to kobo
            metadata: {
              packageId: subscription.package,
              userId: subscription.user,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${config.paystack.secret_key}`,
              'Content-Type': 'application/json',
            },
          },
        )

        if (paymentResponse.data.status) {
          return {
            status: 'success',
            message:
              'Subscription cannot be reactivated. A new payment has been initialized to enable auto-renew.',
            authorizationUrl: paymentResponse.data.data.authorization_url,
          }
        } else {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            paymentResponse.data.message || 'Failed to initialize payment',
          )
        }
      }
      throw error
    }
  } catch (error: any) {
    console.error(
      `Error enabling subscription ${subscriptionCode}: ${error?.response?.data?.message || error.message}`,
    )
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error?.response?.data?.message || 'Failed to enable subscription',
    )
  }
}

// Existing functions
export const createPaystackCheckoutSession = async (payload: TPayload) => {
  const response = await paystack.transaction.initialize({
    email: payload.customer.email,
    amount: payload.product.amount * 100,
    metadata: {
      name: payload.customer.name,
      paymentId: payload.paymentId,
      product: payload.product.name,
      quantity: payload.product.quantity,
    },
    callback_url: `${config.server_url}/payments/confirm-payment?paymentId=${payload.paymentId}`,
  })

  if (!response.status) {
    throw new Error('Failed to initialize Paystack payment')
  }

  return response.data.authorization_url
}

export const verifyPaystackTransaction = async (reference: string) => {
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${config.paystack.secret_key}`,
          'Content-Type': 'application/json',
        },
      },
    )

    return response.data
  } catch (error: any) {
    throw new Error(
      error?.response?.data?.message || 'Paystack verification failed',
    )
  }
}

export const refundPaystackPayment = async (
  transactionId: number,
  customerNote?: string,
) => {
  try {
    const response = await axios.post(
      'https://api.paystack.co/refund',
      {
        transaction: transactionId,
        customer_note:
          customerNote || `Refund for transaction ${transactionId}`,
        merchant_note:
          customerNote || `Refund for transaction ${transactionId}`,
      },
      {
        headers: {
          Authorization: `Bearer ${config.paystack.secret_key}`,
          'Content-Type': 'application/json',
        },
      },
    )

    return response.data
  } catch (error: any) {
    const message =
      error?.response?.data?.message || 'Paystack refund request failed'
    if (message === 'Transaction has been fully reversed') {
      return {
        success: false,
        alreadyRefunded: true,
        message,
      }
    }
    throw new Error(message)
  }
}

export const paymentNotifyToAdmin = async (
  type: 'SUCCESS' | 'REFUND',
  payment: TPayment,
) => {
  const admin = await findAdmin()
  if (!admin || !admin.fcmToken) return

  // Define message and description based on type
  const message =
    type === 'SUCCESS'
      ? messages.paymentManagement.paymentSuccess
      : messages.paymentManagement.paymentRefunded

  const description =
    type === 'SUCCESS'
      ? `A payment of $${payment.amount} has been successfully received. Transaction ID: ${payment.transactionId}.`
      : `A refund of $${payment.amount} has been successfully processed. Refund Transaction ID: ${payment.transactionId}.`

  // Create a notification entry
  const notifyPayload = {
    receiver: admin?._id,
    message,
    description,
    reference: payment.reference,
    model_type: modeType.Payment,
  }

  await sendNotification([admin.fcmToken], notifyPayload)
}

export const paymentNotifyToUser = async (
  type: 'SUCCESS' | 'REFUND',
  payment: TPayment,
) => {
  const user = await User.findById(payment.user)
  if (!user || !user.fcmToken) return

  // Define message and description based on type
  const message =
    type === 'SUCCESS'
      ? messages.paymentManagement.paymentSuccess
      : messages.paymentManagement.paymentRefunded

  const description =
    type === 'SUCCESS'
      ? ` Your payment was successful. Thank you for investing in yourself — this space is always here for you.`
      : `A refund of $${payment.amount} has been issued to your account. Refund Transaction ID: ${payment.transactionId}.`

  // Create a notification entry
  const notifyPayload = {
    receiver: payment?.user,
    message,
    description,
    reference: payment.reference,
    model_type: modeType.Payment,
  }

  await sendNotification([user.fcmToken], notifyPayload)
}
