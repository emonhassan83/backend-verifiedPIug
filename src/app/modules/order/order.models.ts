import { Schema, model } from 'mongoose';
import { TOrder, TOrderModel } from './order.interface';
import { ORDER_AUTHORITY, ORDER_STATUS, PAYMENT_STATUS } from './order.constants';

const paymentSubSchema = new Schema(
  {
    amountPaid: { type: Number, default: 0 },
    paidAt: { type: Date },
    transactionId: { type: String },
    status: {
      type: String,
      enum: Object.keys(PAYMENT_STATUS),
      default: PAYMENT_STATUS.pending
    },
  },
  { _id: false }
);

const orderSchema = new Schema<TOrder>(
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
      enum: Object.keys(ORDER_AUTHORITY),
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
    },
    shortDescription: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    initialAmount: {
      type: Number,
      default: 0,
    },
    pendingAmount: {
      type: Number,
      default: 0,
    },
    finalAmount: {
      type: Number,
      default: 0,
    },

    initialPayment: paymentSubSchema,
    finalPayment: paymentSubSchema,

    startDate: { type: String },
    endDate: { type: String },
    actualStartDate: { type: Date },
    actualEndDate: { type: Date },

    address: { type: String, required: true },
    locationUrl: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },

    status: {
      type: String,
      enum: Object.keys(ORDER_STATUS),
      default: ORDER_STATUS.pending,
    },

    initialPayCompleted: { type: Boolean, default: false },
    finalPayCompleted: { type: Boolean, default: false },
    isFullyPaid: { type: Boolean, default: false },
    isCompleted: { type: Boolean, default: false },

    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Geo index for location queries
orderSchema.index({ location: '2dsphere' });

// Optional: auto-expiry if needed
// orderSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const Order = model<TOrder, TOrderModel>('Order', orderSchema);