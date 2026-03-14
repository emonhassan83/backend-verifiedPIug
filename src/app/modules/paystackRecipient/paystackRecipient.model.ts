import { Schema, model } from 'mongoose'
import { TPaystackRecipient, TPaystackRecipientModel } from './paystackRecipient.interface'
import { RECIPIENT_STATUS } from './paystackRecipient.constant'

const paystackRecipientSchema = new Schema<TPaystackRecipient>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    bankCode: {
      type: String,
      required: true,
    },
    bankName: {
      type: String,
      trim: true,
    },
    currency: {
      type: String,
      default: 'NGN',
    },
    status: {
      type: String,
      enum: Object.values(RECIPIENT_STATUS),
      default: RECIPIENT_STATUS.pending,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    verifiedAt: Date,
    rejectedReason: String,
    metadata: Schema.Types.Mixed,
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ইনডেক্স যোগ করা
paystackRecipientSchema.index({ user: 1, isDefault: 1 });

export const PaystackRecipient = model<TPaystackRecipient, TPaystackRecipientModel>(
  'PaystackRecipient',
  paystackRecipientSchema,
)
