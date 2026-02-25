import { sendNotification } from '../../utils/sentNotification'
import { modeType } from '../notification/notification.interface'
import {
  canSendNotification,
  TNotifyCategory,
} from '../notification/notification.utils'
import { TUser } from '../user/user.interface'
import { KYC_STATUS } from './verification.constants'
import { TVerification } from './verification.interface'

export const sendKycStatusNotification = async (
  verification: TVerification,
  user: TUser,
  category: TNotifyCategory,
  reason?: string | null,
) => {
  if (!canSendNotification(user, category)) return

  const { status } = verification

  const statusTextMap = {
    [KYC_STATUS.pending]: {
      userMsg: 'Your KYC verification is under review.',
      adminMsg: `User ${user?.name} (ID: ${user?._id}) has submitted KYC and is pending review.`,
    },
    [KYC_STATUS.approved]: {
      userMsg: 'Your KYC verification has been approved.',
      adminMsg: `User ${user?.name} (ID: ${user?._id}) has been approved for KYC.`,
    },
    [KYC_STATUS.denied]: {
      userMsg: 'Your KYC verification has been denied. Reason: ' + (reason || 'No reason provided.'),
      adminMsg: `User ${user?.name} (ID: ${user?._id}) has been denied KYC.`,
    },
  }

  //  @ts-ignore
  const content = statusTextMap[status]

  // Notify User
  const payload = {
    receiver: user._id,
    message: 'KYC Verification Update',
    description: content.userMsg,
    reference: verification._id,
    model_type: modeType.KYC,
  }

  try {
    await sendNotification([user.fcmToken], payload)
  } catch (err) {
    console.error('Failed to notify user:', err)
  }
}
