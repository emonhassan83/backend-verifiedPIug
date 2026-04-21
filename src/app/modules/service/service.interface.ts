import { Model, Types } from 'mongoose'
import { TPriceType, TServiceAuthority, TServiceStatus } from './service.constants'

type TServiceAreas = {
  name: string
  locationUrl: string
  location: {
    type: 'Point'
    coordinates: [number, number] // [longitude, latitude]
  }
}

export interface TService {
  _id?: string
  author: Types.ObjectId
  authority: TServiceAuthority
  category: Types.ObjectId
  title: string
  subtitle: string
  description: string
  images: string[]
  // address: string
  // locationUrl: string
  // location: {
  //   type: 'Point'
  //   coordinates: [number, number] // [longitude, latitude]
  // }
  serviceAreas: TServiceAreas[]
  // latitude: number
  // longitude: number
  price: number
  priceType: TPriceType
  isFeatured: boolean
  status: TServiceStatus
  isDeleted?: boolean
  featuredAt?: Date
}

export type TServiceModel = Model<TService, Record<string, unknown>>
