import { Model, Types } from 'mongoose'
import { TPriceType, TServiceStatus } from './order.constants'

export interface TService {
  _id?: string
  author: Types.ObjectId
  category: Types.ObjectId
  title: string
  subtitle: string
  description: string
  images: string[]
  price: number
  priceType: TPriceType
  status: TServiceStatus
  isDeleted?: boolean
}

export type TServiceModel = Model<TService, Record<string, unknown>>
