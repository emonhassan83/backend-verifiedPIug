import { Model } from 'mongoose'

export interface TCategory {
  _id?: string
  title: string
  logo?: string
  listingCount?: number
  isDeleted?: boolean
}

export type TCategoryModel = Model<TCategory, Record<string, unknown>>
