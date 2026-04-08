import emailSender from '../../utils/emailSender'
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

// Success Email
export const sendKycSuccessEmail = async (user: any) => {
  const subject = "✅ Your KYC Verification Has Been Approved!";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2 style="color: #28a745;">Congratulations! 🎉</h2>
      <p>Dear ${user.name || 'Valued User'},</p>
      <p>Your KYC verification has been successfully <strong>approved</strong>.</p>
      <p>You can now enjoy full features including vendor payments, withdrawals, and more.</p>
      
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Status:</strong> Approved</p>
        <p><strong>Verified On:</strong> ${new Date().toLocaleDateString()}</p>
      </div>

      <p>Thank you for completing the verification process.</p>
      <p>Best regards,<br/><strong>Your App Team</strong></p>
    </div>
  `;

  await emailSender(user.email, subject, html);
};

// Rejection Email with Reason
export const sendKycRejectionEmail = async (user: any, reason: string) => {
  const subject = "❌ Your KYC Verification Was Not Approved";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2 style="color: #dc3545;">KYC Verification Update</h2>
      <p>Dear ${user.name || 'Valued User'},</p>
      
      <p>Unfortunately, your KYC verification has been <strong>denied</strong>.</p>
      
      <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p><strong>Reason for Rejection:</strong></p>
        <p style="color: #856404;">${reason}</p>
      </div>

      <p>Please review the issues mentioned above and <strong>resubmit</strong> your verification with correct information.</p>
      
      <p>If you need any assistance, feel free to contact our support team.</p>
      
      <p>Best regards,<br/><strong>Your App Support Team</strong></p>
    </div>
  `;

  await emailSender(user.email, subject, html);
};