import { sendNotification } from '../../utils/sentNotification'
import { modeType } from '../notification/notification.interface'
import { KYC_STATUS } from './verification.constants'

export const sendKycStatusNotification = async (verification: any) => {
  const { user, status } = verification
  if (!user) return

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
      userMsg: 'Your KYC verification has been denied. Please re-submit.',
      adminMsg: `User ${user?.name} (ID: ${user?._id}) has been denied KYC.`,
    },
  }

  //  @ts-ignore
  const content = statusTextMap[status]

  // Notify User
  if (user?.fcmToken) {
    const userPayload = {
      receiver: user._id,
      message: 'KYC Verification Update',
      description: content.userMsg,
      reference: verification._id,
      model_type: modeType.KYC,
    }

    try {
      await sendNotification([user.fcmToken], userPayload)
    } catch (err) {
      console.error('Failed to notify user:', err)
    }
  }
}
