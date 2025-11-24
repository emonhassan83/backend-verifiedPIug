import { Model, Types } from 'mongoose'
import { TDurationType, TOrderStatus, TOrderType } from './order.constants'

export interface TOrder {
  _id?: string
  author: Types.ObjectId
  receiver: Types.ObjectId
  project: Types.ObjectId
  title: string
  type: TOrderType
  description: string
  duration: number
  durationType: TDurationType
  amount: number
  initialPayment: number
  startDate: string
  endDate: string
  location: string
  status: TOrderStatus
  isDeleted?: boolean
}

export type TOrderModel = Model<TOrder, Record<string, unknown>>
