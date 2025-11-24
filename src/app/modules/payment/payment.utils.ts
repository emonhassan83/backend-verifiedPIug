import config from '../../config'
import { messages } from '../Notification/notification.constant'
import { modeType } from '../Notification/notification.interface'
import { TPayment } from './payment.interface'
import { NotificationService } from '../Notification/notification.service'
import { findAdmin } from '../../utils/findAdmin'
//@ts-ignore
import Paystack from 'paystack-api'
import axios from 'axios'
import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import { User } from '../User/user.model'
import { Package } from '../Package/package.model'
import { Subscription } from '../Subscription/subscription.models'
import { Payment } from './payment.model'
import { Types } from 'mongoose'
import crypto from 'crypto'

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

// Plan codes from Paystack
const PLAN_CODES = {
  annual: 'PLN_u07uqjczfxjenxv', // Annual plan
  monthly: 'PLN_snv6mai308v6itr', // Monthly plan
}

// Create a Paystack plan
export const createPaystackPlan = async (packageData: {
  title: string
  price: number
  billingCycle: string
}) => {
  try {
    const response = await paystack.plan.create({
      name: packageData.title,
      amount: packageData.price * 100, // Convert to kobo
      interval: packageData.billingCycle.toLowerCase(), // e.g., 'monthly', 'yearly'
      currency: 'NGN', // Adjust based on your needs
    })

    if (!response.status) {
      throw new Error('Failed to create Paystack plan')
    }

    return response.data.plan_code // e.g., PLN_xxxxxxxxxxx
  } catch (error: any) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error?.response?.data?.message || 'Paystack plan creation failed',
    )
  }
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

  const subscription = await Subscription.findById(packageId).select('package')
  if (!subscription) {
    throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found')
  }

  const packageData = await Package.findById(subscription?.package)
  if (!packageData) {
    throw new AppError(httpStatus.NOT_FOUND, 'Package not found')
  }

  // Map package billing cycle to Paystack plan code
  const planCode =
    packageData.billingCycle.toLowerCase() === 'annually'
      ? PLAN_CODES.annual
      : packageData.billingCycle.toLowerCase() === 'monthly'
        ? PLAN_CODES.monthly
        : null

  if (!planCode) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid billing cycle for package',
    )
  }

  const response = await paystack.transaction.initialize({
    email: user.email,
    amount: packageData.price * 100, // Convert to kobo
    plan: planCode,
    metadata: {
      name: user.name,
      paymentId,
      product: packageData.title,
      packageId: packageData._id,
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
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid webhook signature')
  }

  const event = req.body
  switch (event.event) {
    case 'subscription.create': {
      const { subscription_code, email_token, customer, plan } = event.data
      const user = await User.findOne({ email: customer.email })
      if (!user) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          'User not found for subscription',
        )
      }

      // Try to find subscription by transactionId first
      let subscription = await Subscription.findOne({
        user: user._id,
        amount: plan.amount / 100
      })

      // Fallback: Find by user and package if transactionId not found
      if (!subscription) {
        subscription = await Subscription.findOne({
          user: user._id,
          package: { $exists: true },
          paymentStatus: 'paid',
          createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 minutes
        })
      }

      if (!subscription) {
        console.warn(
          `Subscription not found for user ${user._id}, plan ${plan.plan_code}, email ${customer.email}`,
        )
        throw new AppError(
          httpStatus.NOT_FOUND,
          `Subscription not found for user ${user._id} and plan ${plan.plan_code}`,
        )
      }

      await Subscription.findByIdAndUpdate(
        subscription._id,
        {
          subscriptionCode: subscription_code,
          emailToken: email_token,
          status: 'active',
          createdAt: new Date(event.data.createdAt),
        },
        { new: true },
      )

      await NotificationService.createNotificationIntoDB({
        receiver: user._id,
        message: messages.subscription.newPlan,
        description: `Your ${plan.name} subscription has been activated with code ${subscription_code}.`,
        reference: subscription._id,
        model_type: modeType.Subscription,
      })
      break
    }

    case 'invoice.create': {
      const { subscription_code, amount, due_date } = event.data

      const subscription = await Subscription.findOne({
        subscriptionCode: subscription_code,
      })
      if (subscription) {
        await NotificationService.createNotificationIntoDB({
          receiver: subscription.user,
          message: messages.paymentManagement.upcomingCharge,
          description: `Your subscription will be charged ₦${amount / 100} on ${new Date(due_date).toLocaleDateString()}.`,
          reference: subscription._id,
          model_type: modeType.Subscription,
        })
      }
      break
    }

    case 'charge.success': {
      const { subscription_code, amount, paid_at, reference, metadata } =
        event.data
      const subscription = await Subscription.findOne({
        subscriptionCode: subscription_code,
      })
      if (!subscription) {
        throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found')
      }

      const payment = await Payment.findOne({ transactionId: reference })
      if (payment) {
        await Payment.findByIdAndUpdate(payment._id, {
          isPaid: true,
          status: 'paid',
          paymentIntentId: event.data.id,
          amount: amount / 100,
        })

        await paymentNotifyToUser('SUCCESS', payment)
        // await paymentNotifyToAdmin('SUCCESS', payment)
      } else {
        const newPayment = await Payment.create({
          transactionId: reference,
          amount: amount / 100,
          isPaid: true,
          status: 'paid',
          paymentIntentId: event.data.id,
          account: subscription.user,
          reference: subscription._id,
          modelType: 'Subscription',
        })

        await paymentNotifyToUser('SUCCESS', newPayment)
        // await paymentNotifyToAdmin('SUCCESS', newPayment)
      }

      const interval = event.data.plan.interval === 'annually' ? 12 : 1
      await Subscription.findByIdAndUpdate(subscription._id, {
        paymentStatus: 'paid',
        expiredAt: new Date(paid_at).setMonth(
          new Date(paid_at).getMonth() + interval,
        ),
        isExpired: false,
      })

      await User.findByIdAndUpdate(subscription.user, {
        packageExpiry: new Date(paid_at).setMonth(
          new Date(paid_at).getMonth() + interval,
        ),
      })
      break
    }

    case 'subscription.disable': {
      const { subscription_code } = event.data

      const subscription = await Subscription.findOne({
        subscriptionCode: subscription_code,
      })
      // console.log({subscription});

      if (subscription) {
        await Subscription.findByIdAndUpdate(subscription._id, {
          autoRenew: 'disabled',
        })
        await NotificationService.createNotificationIntoDB({
          receiver: subscription.user,
          message: messages.subscription.cancelled,
          description: `Your subscription has been cancelled.`,
          reference: subscription._id,
          model_type: modeType.Subscription,
        })
      } else {
        console.warn(
          `Subscription not found for subscription_code: ${subscription_code}`,
        )
        throw new AppError(
          httpStatus.NOT_FOUND,
          `Subscription not found for code ${subscription_code}`,
        )
      }
      break
    }

    case 'refund.processed': {
      const { transaction_reference, amount, customer } = event.data
      const payment = await Payment.findOne({
        transactionId: transaction_reference,
      })
      if (payment) {
        await Payment.findByIdAndUpdate(payment._id, {
          status: 'refunded',
          isPaid: false,
        })

        await NotificationService.createNotificationIntoDB({
          receiver: payment.account,
          message: messages.paymentManagement.paymentRefunded,
          description: `A refund of ₦${amount / 100} has been processed for transaction ${transaction_reference}.`,
          reference: payment._id,
          model_type: modeType.Payment,
        })

        const admin = await findAdmin()
        if (admin) {
          await NotificationService.createNotificationIntoDB({
            receiver: admin._id,
            message: messages.paymentManagement.paymentRefunded,
            description: `A refund of ₦${amount / 100} has been processed for transaction ${transaction_reference}.`,
            reference: payment._id,
            model_type: modeType.Payment,
          })
        }
      }
      break
    }

    case 'invoice.payment_failed': {
      const { subscription_code, amount, customer } = event.data
      const subscription = await Subscription.findOne({
        subscriptionCode: subscription_code,
      })
      if (subscription) {
        await Subscription.findByIdAndUpdate(subscription._id, {
          paymentStatus: 'failed',
          status: 'pending_payment',
        })

        const manageLink =
        await getSubscriptionManagementLink(subscription_code)
        await NotificationService.createNotificationIntoDB({
          receiver: subscription.user,
          message: messages.paymentManagement.paymentFailed,
          description: `Your subscription payment of ₦${amount / 100} failed. Please update your payment method: ${manageLink}`,
          reference: subscription._id,
          model_type: modeType.Subscription,
        })
      }
      break
    }

    default:
      console.log('Unhandled webhook event:', event.event)
  }

  return { status: 'success' }
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

    console.log({response});
    

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
  await NotificationService.createNotificationIntoDB({
    receiver: admin?._id,
    message,
    description,
    reference: payment.reference,
    model_type: modeType.Payment,
  })
}

export const paymentNotifyToUser = async (
  type: 'SUCCESS' | 'REFUND',
  payment: TPayment,
) => {
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
  await NotificationService.createNotificationIntoDB({
    receiver: payment?.account,
    message,
    description,
    reference: payment.reference,
    model_type: modeType.Payment,
  })
}
