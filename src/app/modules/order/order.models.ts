import { Schema, model, Types } from 'mongoose'
import { TOrder, TOrderModel } from './order.interface'
import { DURATION_TYPE, ORDER_STATUS, ORDER_TYPE } from './order.constants'

const orderSchema = new Schema<TOrder>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: false,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.keys(ORDER_TYPE),
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
    durationType: {
      type: String,
      enum: Object.keys(DURATION_TYPE),
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    initialPayment: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: String,
      required: true,
    },
    endDate: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.keys(ORDER_STATUS),
      default: ORDER_STATUS.pending,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
)

export const Order = model<TOrder, TOrderModel>('Order', orderSchema)
