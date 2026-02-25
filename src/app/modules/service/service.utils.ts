import { modeType } from '../notification/notification.interface'
import { messages } from '../notification/notification.constant'
import { sendNotification } from '../../utils/sentNotification'
import { SERVICE_STATUS } from './service.constants'
import { TUser } from '../user/user.interface'
import { TService } from './service.interface'
import { Favorite } from '../favorite/favorite.model'
import { canSendNotification, TNotifyCategory } from '../notification/notification.utils'

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
