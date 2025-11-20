import { Schema, model } from 'mongoose'
import { TBanner, TBannerModel } from './banner.interface'

const bannerSchema = new Schema<TBanner>(
  {
    url: {
      type: String,
      required: true,
    },
  }
)

export const Banner = model<TBanner, TBannerModel>(
  'Banner',
  bannerSchema,
)
