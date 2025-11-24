import { modeType } from '../notification/notification.interface'
import { messages } from '../notification/notification.constant'
import { TPackage } from '../package/package.interface'
import { sendNotification } from '../../utils/sentNotification'

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

  const notifyPayload = {
    receiver: user?._id,
    message,
    description,
    reference: subscription?._id,
    model_type: modeType.Subscription,
  }

  await sendNotification([user.fcmToken], notifyPayload)
}
