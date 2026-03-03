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

  let message
  let description

  switch (status) {
    case KYC_STATUS.pending: {
      message = 'KYC Verification Submitted'
      description = 'Your KYC verification is under review.'
      break
    }
    case KYC_STATUS.approved: {
      message = 'KYC Verification Update'
      description = 'Your KYC verification has been approved.'
      break
    }
    case KYC_STATUS.denied: {
      message = 'KYC Verification Update'
      description =
        'Your KYC verification has been denied. Reason: ' +
        (reason || 'No reason provided.')
      break
    }
  }

  // Notify User
  const payload = {
    receiver: user._id,
    message,
    description,
    reference: verification._id,
    model_type: modeType.KYC,
  }

  try {
    await sendNotification([user.fcmToken], payload)
  } catch (err) {
    console.error('Failed to notify user:', err)
  }
}
