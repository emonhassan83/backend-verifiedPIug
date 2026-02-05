import { Schema, model } from 'mongoose'
import { TRefund, TRefundModel } from './refund.interface'
import { REFUND_STATUS } from './refund.constant'

const refundSchema = new Schema<TRefund>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
    processedAt: { type: Date }
  },
  {
    timestamps: true,
  },
)

export const Refund = model<TRefund, TRefundModel>('Refund', refundSchema)
