import { sendNotification } from '../../utils/sentNotification'
import { messages } from '../notification/notification.constant'
import { modeType } from '../notification/notification.interface'
import { User } from '../user/user.model'
import { Types } from 'mongoose'
import { ORDER_STATUS } from './order.constants'
import {
  canSendNotification,
  TNotifyCategory,
} from '../notification/notification.utils'

// 1. When crate order then sent notification only receiver
export const sendNewOrderNotification = async (
  receiverId: Types.ObjectId,
  order: any,
  category: TNotifyCategory,
) => {
  const user = await User.findById(receiverId)
  if (!user) return
  if (!canSendNotification(user, category)) return

  const message = messages.order.newOrder
  const description = `You have received a new order request: "${order.title}". Please review and respond.`

  const notifyPayload = {
    receiver: receiverId,
    reference: order._id,
    message,
    description,
    model_type: modeType.Order,
  }

  // Push notification
  await sendNotification([user.fcmToken], notifyPayload)
}

// 2. Order Status Changed Notification (sender + receiver both)
export const changeOrderStatusNotification = async (
  senderId: Types.ObjectId,
  receiverId: Types.ObjectId,
  order: any,
  status: keyof typeof ORDER_STATUS,
  category: TNotifyCategory,
) => {
  const receiver = await User.findById(receiverId)
  if (!receiver) return
  if (!canSendNotification(receiver, category)) return

  const sender = await User.findById(senderId)
  if (!sender) return
  if (!canSendNotification(sender, category)) return

  let message = ''
  let description = ''

  switch (status) {
    case ORDER_STATUS.running:
      message = messages.order.statusChanged
      description = `Your order "${order.title}" has started and is now in progress.`
      break

    case ORDER_STATUS.completed:
      message = messages.order.statusChanged
      description = `Congratulations! Your order "${order.title}" has been completed successfully.`
      break

    case ORDER_STATUS.cancelled:
      message = messages.order.statusChanged
      description = `Your order "${order.title}" has been cancelled.`
      break

    case ORDER_STATUS.denied:
      message = messages.order.statusChanged
      description = `Your order "${order.title}" has been denied. Please contact support if needed.`
      break

    default:
      message = messages.order.statusChanged
      description = `Your order "${order.title}" status has been updated to "${status}".`
  }

  const notifyPayload = {
    receiver: receiverId,
    reference: order._id,
    message,
    description,
    model_type: modeType.Order,
  }

  await sendNotification([receiver.fcmToken], notifyPayload)
  await sendNotification([sender.fcmToken], notifyPayload)
}
