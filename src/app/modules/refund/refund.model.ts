import { Schema, model } from 'mongoose'
import { TRefund, TRefundModel } from './refund.interface'
import { REFUND_AUTHORITY, REFUND_STATUS } from './refund.constant'

const refundSchema = new Schema<TRefund>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authority: {
      type: String,
      enum: Object.values(REFUND_AUTHORITY),
      required: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    paymentIntentId: { type: String },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(REFUND_STATUS),
      default: REFUND_STATUS.pending,
    },
    processedAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
)

export const Refund = model<TRefund, TRefundModel>('Refund', refundSchema)
