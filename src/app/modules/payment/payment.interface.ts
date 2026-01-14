import { Types } from 'mongoose'
import { TPaymentStatus, TPaymentType } from './payment.constant'

export enum PAYMENT_MODEL_TYPE {
  Order = 'Order',
  Subscription = 'Subscription',
}

export type TPayment = {
  _id: string
  id: string
  modelType: PAYMENT_MODEL_TYPE
  type: TPaymentType
  user: Types.ObjectId
  reference: Types.ObjectId
  transactionId: string
  paymentIntentId: string
  amount: number
  status: TPaymentStatus
  isPaid: boolean
  isDeleted: boolean
  createdAt?: Date
  updatedAt?: Date
}
