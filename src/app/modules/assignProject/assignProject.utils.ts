import { Types } from "mongoose"
import { sendNotification } from "../../utils/sentNotification"
import { messages } from "../notification/notification.constant"
import { modeType } from "../notification/notification.interface"
import { User } from "../user/user.model"
import { VENDOR_ASSIGNMENT_STATUS } from "./assignProject.constants"

export const vendorProjectAssignNotify = async (
  userId: Types.ObjectId,
  order: any,
  status: keyof typeof VENDOR_ASSIGNMENT_STATUS,
) => {
  let message = ''
  let description = ''

  switch (status) {
    case VENDOR_ASSIGNMENT_STATUS.assigned:
      message = messages.projectAssign.newAssign
      description = `Your assignment project "${order.title}" has been assigned to you. Please check your dashboard for details.`
      break

    case VENDOR_ASSIGNMENT_STATUS.inProgress:
      message = messages.projectAssign.statusChanged
      description = `Congratulations! Your assignment project "${order.title}" is now in progress!`
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
    receiver: userId,
    reference: order._id,
    message,
    description,
    model_type: modeType.AssignProject,
  }

  const user = await User.findById(userId).select('fcmToken')
  if (user && user?.fcmToken) {
    await sendNotification([user.fcmToken], notifyPayload)
  }
}