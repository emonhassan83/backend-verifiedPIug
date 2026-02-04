import { USER_ROLE } from '../user/user.constant'
import { TUser } from '../user/user.interface'

export type TNotifyCategory =
  | 'profile'
  | 'service'
  | 'bookings'
  | 'subscription'
  | 'payment'

export type TNotifyAudience = 'ADMIN' | 'USER'

export const canSendNotification = (
  user: TUser,
  category: TNotifyCategory,
): boolean => {
  // ❌ No token → no notify
  if (!user?.fcmToken) return false

  // 🔹 Admin → always allowed
  if (user.role === USER_ROLE.admin) return true

  // 🔹 User notification settings
  const settings = user.notifySettings

  // Master switch
  if (!settings?.all) return false

  // Category specific check
  return Boolean(settings?.[category])
}
