import { Model, Types } from 'mongoose'
import { TRefundAuthority, TRefundStatus } from './refund.constant'

export type TRefund = {
  _id?: string
  sender: Types.ObjectId | string
  receiver: Types.ObjectId | string
  authority: TRefundAuthority
  order: Types.ObjectId | string
  reason: string
  status: TRefundStatus
  processedAt: Date
  isDeleted?: boolean
}

export type TRefundModel = Model<TRefund, Record<string, unknown>>
