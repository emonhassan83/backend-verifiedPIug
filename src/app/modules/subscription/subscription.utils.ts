import axios from 'axios'
import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import config from '../../config'
import { User } from '../user/user.model'
import { modeType } from '../notification/notification.interface'
import { messages } from '../notification/notification.constant'
import { TPackage } from '../package/package.interface'
import { sendNotification } from '../../utils/sentNotification'
import { Subscription } from './subscription.models'
import { RENEW_STATUS, SUBSCRIPTION_STATUS } from './subscription.constants'
import { TUser } from '../user/user.interface'
import { TSubscriptions } from './subscription.interface'
import { USER_STATUS } from '../user/user.constant'
import { canSendNotification } from '../notification/notification.utils'

// Cancel Paystack subscription
export const cancelPaystackSubscription = async (
  subscriptionCode: string,
  emailToken: string,
) => {
  try {
    const sub = await Subscription.findOne({
      subscriptionCode,
      status: SUBSCRIPTION_STATUS.active,
      isDeleted: false,
    })
    if (!sub) {
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
      const isExpired = sub.expiredAt && sub.expiredAt < new Date()
      await Subscription.findByIdAndUpdate(
        sub._id,
        {
          autoRenew: RENEW_STATUS.disabled,
          status: isExpired
            ? SUBSCRIPTION_STATUS.cancelled
            : SUBSCRIPTION_STATUS.active,
          isExpired: isExpired,
        },
        { new: true },
      )

      const user = await User.findById(sub.user)
      // Create a notification entry
      if (user) {
        if (!canSendNotification(user, 'subscription')) return
        const notifyPayload = {
          receiver: sub.user,
          message: messages.subscription.cancelled,
          description: `Your subscription auto-renew has been disabled. You can still access premium features until ${sub.expiredAt?.toLocaleDateString()}.`,
          reference: sub._id,
          model_type: modeType.Subscription,
        }

        await sendNotification([user.fcmToken], notifyPayload)
      }

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
    const sub = await Subscription.findOne({
      subscriptionCode,
      isDeleted: false,
    }).populate('package')
    if (!sub) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        `Subscription not found for code ${subscriptionCode}`,
      )
    }

    const user = await User.findOne({
      _id: sub.user,
      status: USER_STATUS.active,
      isDeleted: false,
    })
    if (!user) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        `User not found for ID: ${sub.user}`,
      )
    }

    // Check if subscription is expired
    const isExpired = sub.expiredAt && sub.expiredAt < new Date()
    if (isExpired) {
      // If expired or cancelled, initiate a new payment to reactivate
      const pkg = sub.package as TPackage
      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          email: user.email,
          amount: pkg.price * 100, // Convert to kobo
          metadata: {
            packageId: sub.package._id,
            userId: sub.user,
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
          sub._id,
          {
            autoRenew: RENEW_STATUS.active,
            status: SUBSCRIPTION_STATUS.active,
            isExpired: false,
          },
          { new: true },
        )

        const user = await User.findById(sub.user)
        if (user && user?.fcmToken) {
          if (!canSendNotification(user, 'subscription')) return
          // Create a notification entry
          const notifyPayload = {
            receiver: sub.user,
            message: messages.subscription.newPlan,
            description: `Your subscription auto-renew has been enabled.`,
            reference: sub._id,
            model_type: modeType.Subscription,
          }

          await sendNotification([user.fcmToken], notifyPayload)
        }

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
            amount: (sub.package as TPackage).price * 100, // Convert to kobo
            metadata: {
              packageId: (sub.package as TPackage)._id,
              userId: sub.user,
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

export const subscriptionNotifyToUser = async (
  action: 'CANCELLED' | 'ENABLED' | 'WARNING' | 'suspend' | 'active',
  subscription: TSubscriptions,
  user: TUser,
  note?: string,
) => {
  if (!canSendNotification(user, 'subscription')) return

  // Determine the message and description based on the action
  let message
  let description

  switch (action) {
    case 'CANCELLED':
      message = messages.subscription.cancelled
      description = `Your subscription (${subscription.subscriptionCode}) has been cancelled successfully.`
      break

    case 'ENABLED':
      message = messages.subscription.newPlan
      description = `Your subscription auto-renew has been enabled. Enjoy uninterrupted access to premium features!`
      break

    case 'WARNING':
      message = messages.subscription.warningForPlan
      description = `Your subscription is expiring today. Please renew to continue enjoying our services!`
      break
    case 'suspend':
      message = messages.subscription.suspended
      description = `Your subscription has been suspended. Please contact support to reactivate it.`
      break
    case 'active':
      message = messages.subscription.active
      description = `Your subscription is now active. Enjoy uninterrupted access to premium features!`
      break
    default:
      throw new Error('Invalid action type')
  }

  const notifyPayload = {
    receiver: user?._id,
    message,
    description,
    reference: subscription?._id,
    model_type: modeType.Subscription,
  }

  await sendNotification([user.fcmToken], notifyPayload)
}
