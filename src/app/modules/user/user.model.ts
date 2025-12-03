import bcrypt from 'bcrypt'
import { Schema, model, Types } from 'mongoose'
import config from '../../config'
import { TUser, UserModel } from './user.interface'
import { generateCryptoString } from '../../utils/generateCryptoString'
import {
  REGISTER_WITH,
  registerWith,
  USER_ROLE,
  USER_STATUS,
} from './user.constant'

// 🔹 Define SocialProfiles Schema
const socialProfilesSchema = new Schema(
  {
    instagram: { type: String, default: null },
    linkedin: { type: String, default: null },
    website: { type: String, default: null },
  },
  { _id: false }, // nested schema, so no _id field
)

// 🔹 Define User Schema
const userSchema = new Schema<TUser>(
  {
    id: {
      type: String,
      unique: true,
      default: () => generateCryptoString(10),
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    fcmToken: {
      type: String,
      default: null,
    },
    photoUrl: {
      type: String,
      default: null,
    },
    contractNumber: {
      type: String,
      default: null,
    },
    address: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: null,
    },
    categories: {
      type: [Schema.Types.ObjectId],
      ref: 'Category',
      default: [],
    },
    locationUrl: {
      type: String,
      default: null,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
    socialProfiles: {
      type: socialProfilesSchema,
      default: {},
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLE),
      default: USER_ROLE.user,
    },
    registerWith: {
      type: String,
      enum: registerWith,
      default: REGISTER_WITH.credentials,
    },
    needsPasswordChange: {
      type: Boolean,
      default: true,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    verification: {
      otp: {
        type: Schema.Types.Mixed,
        default: 0,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      status: {
        type: Boolean,
        default: false,
      },
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.active,
    },
    packageExpiry: {
      type: Date,
      default: null,
    },
    playstackId: {
      type: String
    },
    avgRating: {
      type: Number,
      default: 0,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
    expireAt: {
      type: Date,
      default: () => {
        const expireAt = new Date()
        return expireAt.setMinutes(expireAt.getMinutes() + 30)
      },
    },
    balance: {
      type: Number,
      default: 0,
    },
    notifySettings: {
      all: {
        type: Boolean,
        default: true, // master switch
      },
      profile: {
        type: Boolean,
        default: false,
      },
      service: {
        type: Boolean,
        default: false,
      },
      bookings: {
        type: Boolean,
        default: false,
      },
      subscription: {
        type: Boolean,
        default: false,
      },
      payment: {
        type: Boolean,
        default: false,
      },
    },
    isKycVerified: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

// 🔹 Index & Geo
userSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 })
userSchema.index({ location: '2dsphere' })

// 🔹 Pre-save hook for password hashing
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(
      this.password,
      Number(config.bcrypt_salt_rounds),
    )
  }
  next()
})

// 🔹 Static methods
userSchema.statics.isUserExistsByEmail = async function (email: string) {
  return await this.findOne({ email })
}

userSchema.statics.isPasswordMatched = async function (
  plainTextPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(plainTextPassword, hashedPassword)
}

// 🔹 Export Model
export const User = model<TUser, UserModel>('User', userSchema)
