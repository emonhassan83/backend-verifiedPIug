import { Model, Types } from 'mongoose'
import { TWithdrawMethod, TWithdrawStatus } from './withdraw.constant'

export type TWithdraw = {
  _id?: string
  user: Types.ObjectId
  method: TWithdrawMethod
  amount: number
  playstackId?: string
  status: TWithdrawStatus
  createdAt?: Date
}

export type TWithdrawModel = Model<TWithdraw, Record<string, unknown>>
