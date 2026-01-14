import { Model, Types } from 'mongoose'
import { TRefundStatus } from './refund.constant'

export type TRefund = {
  _id?: string
  sender: Types.ObjectId | string
  receiver: Types.ObjectId | string
  order: Types.ObjectId | string
  reason: string
  status: TRefundStatus
  isDeleted?: boolean
}

export type TRefundModel = Model<TRefund, Record<string, unknown>>
