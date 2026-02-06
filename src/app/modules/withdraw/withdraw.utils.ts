import { findAdmin } from '../../utils/findAdmin'
import { sendNotification } from '../../utils/sentNotification'
import { messages } from '../notification/notification.constant'
import { modeType } from '../notification/notification.interface'
import { canSendNotification } from '../notification/notification.utils'
import { TUser } from '../user/user.interface'
import { TWithdrawStatus } from './withdraw.constant'

export const sendWithdrawalRequestNotify = async (
  withdraw: any, // your Withdraw document
  user: any, // User document
) => {
  const admin = await findAdmin()
  if (!admin || !admin.fcmToken) return

  const payload = {
    receiver: user?._id,
    message: messages.withdraw.addRequest,
    description: `User ${user.fullname || user.email} requested ₦${withdraw.amount} withdrawal`,
    reference: withdraw?._id,
    model_type: modeType.Withdraw,
  }

  // Send push notification to all admins who have fcmToken
  await sendNotification([admin.fcmToken], payload)
}

export const sendWithdrawalStatusNotify = async (
  withdraw: any,
  user: TUser,
  status: TWithdrawStatus
) => {
 if (!canSendNotification(user, 'payment')) return
 
   // Determine the message and description based on the action
   let message
   let description
 
   switch (status) {
     case 'approved':
       message = messages.refund.changedStatus
       description = `Your withdrawal request of ₦${withdraw.amount} has been approved by admin and will be processed soon.`;
       break
     case 'cancelled':
       message = messages.refund.changedStatus
       description = `Your withdrawal request of ₦${withdraw.amount} has been cancelled by admin.`;
       break
     default:
       throw new Error('Invalid action type')
   }
 
   // Create a notification entry
   const notifyPayload = {
     receiver: user?._id,
     message,
     description: description,
     reference: withdraw?._id,
     model_type: modeType.Withdraw,
   }
 
   await sendNotification([user.fcmToken], notifyPayload)
}
