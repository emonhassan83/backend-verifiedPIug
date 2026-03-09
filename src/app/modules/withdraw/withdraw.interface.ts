import { Model, Types } from 'mongoose'
import { TWithdrawAuthority, TWithdrawMethod, TWithdrawStatus } from './withdraw.constant'

export type TWithdraw = {
  _id?: string
  user: Types.ObjectId
  authority: TWithdrawAuthority
  method: TWithdrawMethod
  amount: number
  paystackTransferId?: string
  recipientCode?: string
  note: string
  status: TWithdrawStatus
  proceedAt?: Date
  createdAt?: Date
}

export type TWithdrawModel = Model<TWithdraw, Record<string, unknown>>
