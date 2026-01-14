import { modeType } from '../notification/notification.interface'
import { messages } from '../notification/notification.constant'
import { NotificationService } from '../notification/notification.service'

export const refundAddNotifyToVendor = async (
  action: 'ADDED',
  user: any,
  vendor: any,
  refund: any,
) => {
  // Determine the message and description based on the action
  let message
  let description

  switch (action) {
    case 'ADDED':
      message = messages.refundManagement.addRefund
       description = `A refund request has been initiated by ${user?.name} for product ID ${refund?.product}.`
      break
    default:
      throw new Error('Invalid action type')
  }

  // Create a notification entry
  await NotificationService.createNotificationIntoDB({
    receiver: vendor?._id,
    message,
    description,
    reference: refund?._id,
    model_type: modeType.Refund,
  })
}

export const refundChangeStatusNotifyToUser = async (
  action: 'CHANGED_STATUS',
  user: any,
  refund: any,
) => {
  // Determine the message and description based on the action
  let message
  let description

  switch (action) {
    case 'CHANGED_STATUS':
      message = messages.refundManagement.refundStatusChange
      description = `The status of your refund request for product ID ${refund?.product} has been updated to "${refund?.status}".`
      break
    default:
      throw new Error('Invalid action type')
  }

  // Create a notification entry
  await NotificationService.createNotificationIntoDB({
    receiver: user?._id,
    message,
    description,
    reference: refund?._id,
    model_type: modeType.Refund,
  })
}
