import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import { TUser } from './user.interface'
import { User } from './user.model'
import QueryBuilder from '../../builder/QueryBuilder'
import { USER_ROLE } from './user.constant'
import {
  sendUserStatusNotifYToAdmin,
  sendUserStatusNotifYToUser,
} from './user.utils'
import { Subscription } from '../subscription/subscription.models'
import { PAYMENT_STATUS } from '../payment/payment.constant'
import { SUBSCRIPTION_STATUS } from '../subscription/subscription.constants'
import { PaystackRecipient } from '../paystackRecipient/paystackRecipient.model'
import { RECIPIENT_STATUS } from '../paystackRecipient/paystackRecipient.constant'

const generateLocationUrl = (lat: number, lng: number) => {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

const registerUserIntoDB = async (payload: TUser) => {
  const { password, confirmPassword } = payload
  if (password !== confirmPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Passwords do not match')
  }

  if (payload.role === 'admin') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You cannot directly assign admin role',
    )
  }

  const existingUser = await User.findOne({ email: payload.email })
  if (existingUser) {
    // 🟡 Soft deleted user — recreate
    if (existingUser.isDeleted) {
      existingUser.set({ ...payload, isDeleted: false })
      const user = await existingUser.save()
      return user
    }

    // 🟡 Unverified user — update fields and re-save
    if (!existingUser.verification?.status) {
      existingUser.set({ ...payload })
      const user = await existingUser.save()
      return user
    }

    // 🔴 Already active user
    throw new AppError(
      httpStatus.FORBIDDEN,
      'User already exists with this email',
    )
  }

  // 🟢 New user
  if (!payload.password) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password is required')
  }

  const newUser = new User(payload)
  await newUser.save()

  return newUser
}

const getAllUsersFromDB = async (query: Record<string, unknown>) => {
  const usersQuery = new QueryBuilder(
    User.find({ isDeleted: false, role: { $ne: USER_ROLE.admin } }).select(
      '_id id name email photoUrl role address contractNumber categories status createdAt',
    ),
    query,
  )
    .search(['name'])
    .filter()
    .sort()
    .paginate()
    .fields()

  const result = await usersQuery.modelQuery
  const meta = await usersQuery.countTotal()

  return {
    meta,
    result,
  }
}

const geUserByIdFromDB = async (id: string) => {
  const user = await User.findById(id)
    .select(
      '_id id name email bio photoUrl coverPhoto location address contractNumber locationUrl socialProfiles role categories notifySettings avgRating ratingCount status isKycVerified createdAt',
    )
    .lean()
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  const today = new Date()

  const [activeSubscription, paystackRecipient] = await Promise.all([
    Subscription.findOne({
      user: id,
      paymentStatus: PAYMENT_STATUS.paid,
      status: SUBSCRIPTION_STATUS.active,
      isDeleted: false,
      isExpired: false,
      expiredAt: { $gt: today },
    })
      .select('type expiredAt')
      .lean(),

    PaystackRecipient.findOne({
      user: id,
      isDeleted: false,
      status: { $in: [RECIPIENT_STATUS.pending, RECIPIENT_STATUS.verified] },
    })
      .select('_id')
      .lean(),
  ])

  return {
    ...user,
    isActiveSubscription: !!activeSubscription,
    type: activeSubscription?.type || null,
    isPaystackRecipient: !!paystackRecipient,
  }
}

const changeUserStatusFromDB = async (payload: any) => {
  const { userId, status } = payload

  //* if the user is is not exist
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  const result = await User.findByIdAndUpdate(
    userId,
    { status },
    { new: true },
  ).select(
    '_id id name email photoUrl address contractNumber locationUrl socialProfiles role avgRating ratingCount status isKycVerified createdAt',
  )
  if (!result) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'User not found and failed to update status!',
    )
  }

  // Send notification to both user and admin
  await sendUserStatusNotifYToUser(status, result, 'profile')
  await sendUserStatusNotifYToAdmin(status, result, 'profile')

  return result
}

const updateNotifySettings = async (
  id: string,
  payload: Partial<TUser['notifySettings']>,
) => {
  const user = await User.findById(id)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  // Current settings
  const current = user.notifySettings

  // Merge incoming fields with current state
  const updated = { ...current, ...payload }

  // BUSINESS LOGIC RULES

  // CASE 1: Client enables "all"
  if (payload.all === true) {
    updated.all = true
    updated.profile = true
    updated.service = true
    updated.bookings = true
    updated.subscription = true
    updated.payment = true
  }

  // CASE 2: Client disables a specific item (e.g. profile = false)
  // → all must be disabled
  const anyDisabled =
    !updated.profile ||
    !updated.service ||
    !updated.bookings ||
    !updated.subscription ||
    !updated.payment

  if (anyDisabled) {
    updated.all = false
  }

  // CASE 3: If everything is true except ALL
  const allTrue =
    updated.profile &&
    updated.service &&
    updated.bookings &&
    updated.subscription &&
    updated.payment

  if (allTrue) {
    updated.all = true
  }

  const result = await User.findByIdAndUpdate(
    id,
    { notifySettings: updated },
    { new: true },
  ).select('_id id name email notifySettings')

  return result
}

const updateUserInfoFromDB = async (
  userId: string,
  payload: Partial<TUser> & {
    latitude?: number
    longitude?: number
  },
) => {
  //* 1. Check user exists
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  //* 2. Check blocked status
  if (user.status === 'blocked') {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked!')
  }

  //* 3. Prepare update object
  const updateData: Partial<TUser> & {
    location?: any
    locationUrl?: string
  } = { ...payload }

  //* 4. Handle location update
  if (payload.latitude && payload.longitude) {
    updateData.location = {
      type: 'Point',
      coordinates: [payload.longitude, payload.latitude],
    }

    updateData.locationUrl = generateLocationUrl(
      payload.latitude,
      payload.longitude,
    )

    // remove extra fields (important)
    delete (updateData as any).latitude
    delete (updateData as any).longitude
  }

  //* 5. Update user
  const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
  }).select(
    '_id id name email photoUrl address contractNumber location locationUrl socialProfiles role avgRating ratingCount status isKycVerified createdAt',
  )

  if (!updatedUser) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'User not found and failed to update!',
    )
  }

  return updatedUser
}

const updateLocationFromDB = async (
  userId: string,
  payload: { longitude: number; latitude: number; address: string },
) => {
  const { longitude, latitude, address } = payload

  //* if the user is is not exist
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  if (!longitude || !latitude) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Longitude and latitude are required',
    )
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      location: { type: 'Point', coordinates: [longitude, latitude] },
      address: address,
    },
    { new: true },
  )

  return updatedUser
}

const deleteAUserFromDB = async (userId: string) => {
  //* Check if the user exists
  const user = await User.findById(userId).select('_id')
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  // Use `Promise.all` to execute updates in parallel
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { isDeleted: true },
    { new: true },
  ).select('_id id name email photoUrl contactNumber status isDeleted')

  if (!updatedUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'Failed to update user status!')
  }

  return updatedUser
}

export const UserService = {
  registerUserIntoDB,
  getAllUsersFromDB,
  geUserByIdFromDB,
  changeUserStatusFromDB,
  updateNotifySettings,
  updateUserInfoFromDB,
  updateLocationFromDB,
  deleteAUserFromDB,
}
