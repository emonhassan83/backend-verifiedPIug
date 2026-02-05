import { model, Schema } from 'mongoose'
import { TSubscriptions, TSubscriptionsModel } from './subscription.interface'
import {
  PAYMENT_STATUS,
  RENEW_STATUS,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TYPE,
} from './subscription.constants'

// Define the Mongoose schema
const SubscriptionsSchema = new Schema<TSubscriptions>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    package: { type: Schema.Types.ObjectId, ref: 'Package', required: true },
    type: {
      type: String,
      enum: Object.values(SUBSCRIPTION_TYPE),
      required: true,
    },
    transactionId: { type: String, default: null },
    amount: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.unpaid,
    },
    status: {
      type: String,
      enum: Object.values(SUBSCRIPTION_STATUS),
      default: SUBSCRIPTION_STATUS.pending,
    },
    autoRenew: {
      type: String,
      enum: Object.values(RENEW_STATUS),
      default: RENEW_STATUS.active,
    },
    subscriptionCode: { type: String, default: null },
    emailToken: {
      type: String, // New field to store Paystack email_token
    },
    expiredAt: { type: Date, default: null },
    isExpired: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
)

// Create and export the model
export const Subscription = model<TSubscriptions, TSubscriptionsModel>(
  'Subscription',
  SubscriptionsSchema,
)
