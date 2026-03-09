import { Schema, model } from 'mongoose'
import { TWithdraw, TWithdrawModel } from './withdraw.interface'
import {
  WITHDRAW_AUTHORITY,
  WITHDRAW_METHOD,
  WITHDRAW_STATUS,
} from './withdraw.constant'

const withdrawSchema = new Schema<TWithdraw>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authority: {
      type: String,
      enum: Object.values(WITHDRAW_AUTHORITY),
      required: true,
    },
    method: {
      type: String,
      enum: Object.values(WITHDRAW_METHOD),
      default: WITHDRAW_METHOD.playstack,
    },
    amount: { type: Number, required: true },
    paystackTransferId: { type: String, default: null },
    recipientCode: { type: String, required: true },
    note: { type: String },
    proceedAt: { type: Date },
    status: {
      type: String,
      enum: Object.values(WITHDRAW_STATUS),
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

export const Withdraw = model<TWithdraw, TWithdrawModel>(
  'Withdraw',
  withdrawSchema,
)
