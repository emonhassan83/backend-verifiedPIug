import { Model, Types } from 'mongoose'
import { TPackage } from '../package/package.interface'
import {
  TPaymentStatus,
  TRenewStatus,
  TSubscriptionStatus,
  TSubscriptionType,
} from './subscription.constants'

export interface TSubscriptions {
  _id: Types.ObjectId | string
  user: Types.ObjectId
  package: Types.ObjectId | TPackage
  type: TSubscriptionType
  transactionId: string
  emailToken: string
  subscriptionCode: string
  amount: number
  expiredAt: Date
  paymentStatus: TPaymentStatus
  status: TSubscriptionStatus
  autoRenew: TRenewStatus
  isExpired: boolean
  isDeleted: boolean
}

export type TSubscriptionsModel = Model<TSubscriptions, Record<string, unknown>>
