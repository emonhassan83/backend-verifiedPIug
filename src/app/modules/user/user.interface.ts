import { Model, Types } from 'mongoose'
import { TUserRole, TUserStatus } from './user.constant'

type TSocialProfiles = {
  instagram: string
  linkedin: string
  website: string
}

export interface TUser {
  _id: Types.ObjectId
  id: string
  name: string
  email: string
  password: string
  fcmToken: string
  photoUrl?: string
  contractNumber?: string
  address: string
  bio: string
  categories: Types.ObjectId[]
  locationUrl: string
  location: {
    type: 'Point'
    coordinates: [number, number] // [longitude, latitude]
  }
  socialProfiles: TSocialProfiles
  role: TUserRole
  registerWith: string
  needsPasswordChange: boolean
  passwordChangedAt?: Date
  verification: {
    otp: string | number
    expiresAt: Date
    status: boolean
  }
  status: TUserStatus
  packageExpiry?: Date
  playstackId?: string
  avgRating: number
  ratingCount: number
  balance: number
  expireAt: Date
  notifySettings: {
    all: boolean
    profile: boolean
    service: boolean
    bookings: boolean
    subscription: boolean
    payment: boolean
  }
  isDeleted: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface TReqUser {
  _id: string
  email: string
  role: TUserRole
  iat: number
  exp: number
}

export interface UserModel extends Model<TUser> {
  isUserExistsByUserName(name: string): Promise<TUser>
  isUserExistsByEmail(email: string): Promise<TUser>

  isPasswordMatched(
    plainTextPassword: string,
    hashedPassword: string,
  ): Promise<boolean>
}
