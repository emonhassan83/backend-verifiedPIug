import { Types } from 'mongoose'

export enum modeType {
  Auth = 'Auth',
  User = 'User',
  Service = 'Service',
  Order = 'Order',
  Refund = 'Refund',
  Subscription = 'Subscription',
  Payment = 'Payment',
  KYC = 'KYC',
}

export type TNotification = {
  receiver?: Types.ObjectId | string
  message: string
  description?: string
  reference?: Types.ObjectId | string
  model_type?: modeType
  date?: Date
  read?: boolean
  isDeleted?: boolean
}
