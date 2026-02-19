import { Model, Types } from 'mongoose'
import { TPriceType, TServiceAuthority, TServiceStatus } from './service.constants'

export interface TService {
  _id?: string
  author: Types.ObjectId
  authority: TServiceAuthority
  category: Types.ObjectId
  title: string
  subtitle: string
  description: string
  images: string[]
  address: string
  locationUrl: string
  location: {
    type: 'Point'
    coordinates: [number, number] // [longitude, latitude]
  }
  latitude: number
  longitude: number
  price: number
  priceType: TPriceType
  isFeatured: boolean
  status: TServiceStatus
  isDeleted?: boolean
}

export type TServiceModel = Model<TService, Record<string, unknown>>
