import { modeType } from '../notification/notification.interface'
import { messages } from '../notification/notification.constant'
import { sendNotification } from '../../utils/sentNotification'
import { SERVICE_STATUS } from './service.constants'
import { TUser } from '../user/user.interface'
import { TService } from './service.interface'
import { Favorite } from '../favorite/favorite.model'
import { canSendNotification, TNotifyCategory } from '../notification/notification.utils'
import emailSender from '../../utils/emailSender'

export const attachFavoriteFlag = async (
  services: any[],
  userId: string,
) => {
  if (!userId) {
    return services.map(service => ({
      ...service.toObject(),
      isFavorite: false,
    }))
  }

  // 1️⃣ Get all favorite service IDs for this user
  const favorites = await Favorite.find({ user: userId })
    .select('service')
    .lean()

  const favoriteServiceIds = new Set(
    favorites.map(fav => fav.service.toString()),
  )

  // 2️⃣ Attach isFavorite flag
  return services.map(service => ({
    ...service.toObject(),
    isFavorite: favoriteServiceIds.has(service._id.toString()),
  }))
}

export const sendServiceStatusNotifyToAuthor = async (
  status: keyof typeof SERVICE_STATUS,
  user: TUser,
  service: TService,
  category: TNotifyCategory,
  reason?: string,
) => {
  if (!canSendNotification(user, category)) return

  let message = ''
  let description = ''

  switch (status) {
    case SERVICE_STATUS.active:
      message = messages.service.approved
      description = `Your service "${service.title}" has been approved and is now live.`
      break

    case SERVICE_STATUS.denied:
      message = messages.service.denied
      description = `Your service "${service.title}" has been denied. Reason: ${reason || 'No reason provided'}`
      break
  }

  const notifyPayload = {
    receiver: user._id,
    message,
    description,
    reference: service._id,
    model_type: modeType.Service,
  }

  await sendNotification([user.fcmToken], notifyPayload)
}

// ====================== SERVICE STATUS EMAIL ======================

// Success Email - When Service is Activated
export const sendServiceActivatedEmail = async (author: any, service: any) => {
  const subject = "✅ Your Service Has Been Approved & Activated!";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2>Congratulations! 🎉</h2>
      <p>Dear ${author.name || 'Valued Author'},</p>
      
      <p>Your service <strong>"${service.title}"</strong> has been successfully <strong>approved and activated</strong> by our admin team.</p>
      
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Service Title:</strong> ${service.title}</p>
        <p><strong>Status:</strong> Active</p>
        <p><strong>Activated On:</strong> ${new Date().toLocaleDateString()}</p>
      </div>

      <p>Now your service is live and visible to all users. You can start receiving bookings and leads.</p>
      
      <p>Thank you for being part of our platform.</p>
      <p>Best regards,<br/><strong>Your App Team</strong></p>
    </div>
  `;

  await emailSender(author.email, subject, html);
};

// Rejection Email - When Service is Denied
export const sendServiceRejectedEmail = async (author: any, service: any, reason?: string) => {
  const subject = "❌ Your Service Has Been Rejected";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2>Service Review Update</h2>
      <p>Dear ${author.name || 'Valued Author'},</p>
      
      <p>Unfortunately, your service <strong>"${service.title}"</strong> has been <strong>rejected</strong> by our review team.</p>
      
      <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p><strong>Reason for Rejection:</strong></p>
        <p style="color: #856404;">${reason || 'Not provided'}</p>
      </div>

      <p>Please review the reason above and make necessary corrections. You can resubmit the service after fixing the issues.</p>
      
      <p>If you need any help, feel free to contact our support team.</p>
      
      <p>Best regards,<br/><strong>Your App Support Team</strong></p>
    </div>
  `;

  await emailSender(author.email, subject, html);
};