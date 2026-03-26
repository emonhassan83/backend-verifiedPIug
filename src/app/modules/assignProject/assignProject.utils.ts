import { sendNotification } from '../../utils/sentNotification'
import { messages } from '../notification/notification.constant'
import { modeType } from '../notification/notification.interface'
import { VENDOR_ASSIGNMENT_STATUS } from './assignProject.constants'
import {
  canSendNotification,
  TNotifyCategory,
} from '../notification/notification.utils'
import { TUser } from '../user/user.interface'
import { TAssignProject } from './assignProject.interface'

export const vendorProjectAssignNotify = async (
  user: TUser,
  order: any,
  status: keyof typeof VENDOR_ASSIGNMENT_STATUS | 'make_as_payment',
  category: TNotifyCategory,
  assignProject?: TAssignProject | null,
) => {
  if (!canSendNotification(user, category)) return

  let message
  let description

  switch (status) {
    case VENDOR_ASSIGNMENT_STATUS.assigned:
      message = messages.projectAssign.newAssign
      description = `Your assignment project "${order.title}" has been assigned to you. Please check your dashboard for details.`
      break

    case 'make_as_payment':
      message = messages.projectAssign.statusChanged
      description = `You received ₦${assignProject!.agreedAmount.toLocaleString()} for completing the project.!`
      break

    case VENDOR_ASSIGNMENT_STATUS.completed:
      message = messages.projectAssign.statusChanged
      description = `Great job! Your assignment project "${order.title}" has been marked as completed!`
      break

    case VENDOR_ASSIGNMENT_STATUS.cancelled:
      message = messages.projectAssign.statusChanged
      description = `Your assignment project "${order.title}" has been cancelled. Please contact support for more information.`
      break

    default:
      message = messages.projectAssign.statusChanged
      description = `Your assignment project "${order.title}" status has been updated to "${status}".`
  }

  const notifyPayload = {
    receiver: user._id,
    reference: order._id,
    message,
    description,
    model_type: modeType.AssignProject,
  }

  await sendNotification([user.fcmToken], notifyPayload)
}
