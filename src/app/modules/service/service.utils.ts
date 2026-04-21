import { modeType } from '../notification/notification.interface'
import { messages } from '../notification/notification.constant'
import { sendNotification } from '../../utils/sentNotification'
import { SERVICE_STATUS } from './service.constants'
import { TUser } from '../user/user.interface'
import { TService } from './service.interface'
import { Favorite } from '../favorite/favorite.model'
import { canSendNotification, TNotifyCategory } from '../notification/notification.utils'
import emailSender from '../../utils/emailSender'

// utils/southAfricaProvinces.ts
export const SA_PROVINCES = [
  {
    name: 'Gauteng',
    location: { lng: 28.0473, lat: -26.2041 },
    locationUrl: 'https://maps.google.com/?q=Gauteng'
  },
  {
    name: 'Western Cape',
    location: { lng: 18.4241, lat: -33.9249 },
    locationUrl: 'https://maps.google.com/?q=Western+Cape'
  },
  {
    name: 'KwaZulu-Natal',
    location: { lng: 31.0218, lat: -29.8587 },
    locationUrl: 'https://maps.google.com/?q=KwaZulu-Natal'
  },
  {
    name: 'Eastern Cape',
    location: { lng: 26.4194, lat: -32.2968 },
    locationUrl: 'https://maps.google.com/?q=Eastern+Cape'
  },
  {
    name: 'Mpumalanga',
    location: { lng: 30.0000, lat: -25.5653 },
    locationUrl: 'https://maps.google.com/?q=Mpumalanga'
  },
  {
    name: 'Limpopo',
    location: { lng: 29.4179, lat: -23.4013 },
    locationUrl: 'https://maps.google.com/?q=Limpopo'
  },
  {
    name: 'North West',
    location: { lng: 24.7415, lat: -26.6981 },
    locationUrl: 'https://maps.google.com/?q=North+West'
  },
  {
    name: 'Free State',
    location: { lng: 26.7968, lat: -28.4541 },
    locationUrl: 'https://maps.google.com/?q=Free+State'
  },
  {
    name: 'Northern Cape',
    location: { lng: 24.0125, lat: -30.3024 },
    locationUrl: 'https://maps.google.com/?q=Northern+Cape'
  }
]

// Helper function to get province details by name
export const getProvinceDetails = (provinceName: string) => {
  const province = SA_PROVINCES.find(
    p => p.name.toLowerCase() === provinceName.toLowerCase()
  )
  
  if (!province) {
    throw new Error(`Invalid province name: ${provinceName}. Valid provinces: ${SA_PROVINCES.map(p => p.name).join(', ')}`)
  }
  
  return province
}

// Helper function to validate and attach province details
export const attachProvinceDetails = (provinceNames: string[]) => {
  const provincesWithDetails = []
  
  for (const name of provinceNames) {
    const province = getProvinceDetails(name)
    provincesWithDetails.push({
      name: province.name,
      locationUrl: province.locationUrl,
      location: {
        type: 'Point',
        coordinates: [province.location.lng, province.location.lat]
      }
    })
  }
  
  return provincesWithDetails
}

// Helper function to calculate distance
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

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