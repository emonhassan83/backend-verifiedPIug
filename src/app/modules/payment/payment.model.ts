import { model, Schema } from 'mongoose'
import { PAYMENT_MODEL_TYPE, TPayment } from './payment.interface'
import { generateCryptoString } from '../../utils/generateCryptoString'
import { PAYMENT_STATUS, PAYMENT_TYPE } from './payment.constant'

const paymentSchema = new Schema<TPayment>(
  {
    id: {
      type: String,
      unique: true,
      default: () => generateCryptoString(10),
    },
    modelType: {
      type: String,
      enum: Object.values(PAYMENT_MODEL_TYPE),
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(PAYMENT_TYPE),
      default: PAYMENT_TYPE.full,
    },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reference: {
      type: Schema.Types.ObjectId,
      refPath: 'modelType',
      required: true,
    },
    transactionId: { type: String, unique: true },
    amount: { type: Number, min: 0 },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.unpaid,
    },
    paymentIntentId: {
      type: String,
      default: null,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

paymentSchema.pre('find', function (next) {
  //@ts-ignore
  this.find({ isDeleted: { $ne: true } })
  next()
})

paymentSchema.pre('findOne', function (next) {
  //@ts-ignore
  this.find({ isDeleted: { $ne: true } })
  next()
})

paymentSchema.pre('aggregate', function (next) {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } })
  next()
})

export const Payment = model<TPayment>('Payment', paymentSchema)
