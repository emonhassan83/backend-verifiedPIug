import { modeType } from '../Notification/notification.interface'
import { messages } from '../Notification/notification.constant'
import { findAdmin } from '../../utils/findAdmin'
import { NotificationService } from '../Notification/notification.service'
import { TPackage } from '../Package/package.interface'
import { TUser } from '../User/user.interface'

export const subscriptionNotifyToAdmin = async (
  action: 'ADDED',
  packages: TPackage,
  subscription: any,
) => {
  const admin = await findAdmin()

  // Determine the message and description based on the action
  let message
  let description

  switch (action) {
    case 'ADDED':
      message = messages.subscription.newPlan
      description = `A new subscription plan titled "${packages?.title}" has been successfully purchased by a user.`
      break
    default:
      throw new Error('Invalid action type')
  }

  // Create a notification entry
  await NotificationService.createNotificationIntoDB({
    receiver: admin?._id,
    message,
    description,
    reference: subscription?._id,
    model_type: modeType.Subscription,
  })
}

export const subscriptionNotifyToUser = async (
  action: 'ADDED' | 'WARNING',
  packages: TPackage,
  subscription?: any,
  user?: any,
) => {
  // Determine the message and description based on the action
  let message
  let description

  switch (action) {
    case 'ADDED':
      message = messages.subscription.newPlan
      description = `You’ve successfully subscribed to the Dear Henrietta Premium plan. Welcome to deeper healing, your way.`
      break

      case 'WARNING':
      message = messages.subscription.warningForPlan
      description = `Your subscription is expiring today. Please renew to continue enjoying our services!`
      break
    default:
      throw new Error('Invalid action type')
  }

  // Create a notification entry
  await NotificationService.createNotificationIntoDB({
    receiver: user?._id,
    message,
    description,
    reference: subscription?._id,
    model_type: modeType.Subscription,
  })
}
