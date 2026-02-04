import { modeType } from '../notification/notification.interface'
import { messages } from '../notification/notification.constant'
import { TUser } from '../user/user.interface'
import { TRefund } from './refund.interface'
import {
  canSendNotification,
  TNotifyCategory,
} from '../notification/notification.utils'
import { sendNotification } from '../../utils/sentNotification'

export const refundAddNotifyToVendor = async (
  action: 'ADDED',
  user: TUser,
  vendor: TUser,
  refund: TRefund,
  category: TNotifyCategory,
) => {
  if (!canSendNotification(user, category)) return

  // Determine the message and description based on the action
  let message
  let description

  switch (action) {
    case 'ADDED':
      message = messages.refund.addRequest
      description = `A refund request has been initiated by ${user?.name} for order.`
      break
    default:
      throw new Error('Invalid action type')
  }

  // Create a notification entry
  const notifyPayload = {
    receiver: vendor?._id,
    message,
    description,
    reference: refund?._id,
    model_type: modeType.Refund,
  }

  await sendNotification([user.fcmToken], notifyPayload)
}

export const refundChangeStatusNotifyToUser = async (
  action: 'CHANGED_STATUS',
  user: TUser,
  refund: TRefund,
  category: TNotifyCategory,
) => {
  if (!canSendNotification(user, category)) return

  // Determine the message and description based on the action
  let message
  let description

  switch (action) {
    case 'CHANGED_STATUS':
      message = messages.refund.changedStatus
      description = `The status of your refund request for order has been updated to "${refund?.status}".`
      break
    default:
      throw new Error('Invalid action type')
  }

  // Create a notification entry
  const notifyPayload = {
    receiver: user?._id,
    message,
    description,
    reference: refund?._id,
    model_type: modeType.Refund,
  }

  await sendNotification([user.fcmToken], notifyPayload)
}
