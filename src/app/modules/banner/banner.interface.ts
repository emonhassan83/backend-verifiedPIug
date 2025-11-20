import { Model } from 'mongoose'

export interface TBanner {
  _id?: string
  url: string
}

export type TBannerModel = Model<TBanner, Record<string, unknown>>
