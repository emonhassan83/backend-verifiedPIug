import { Schema, model } from 'mongoose'
import { TWithdraw, TWithdrawModel } from './withdraw.interface'
import { WITHDRAW_METHOD, WITHDRAW_STATUS } from './withdraw.constant'

const withdrawSchema = new Schema<TWithdraw>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    method: {
      type: String,
      enum: Object.values(WITHDRAW_METHOD),
      required: true,
    },
    amount: { type: Number, required: true },
    playstackId: { type: String },
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
