import { Schema, model } from 'mongoose'
import { TCategory, TCategoryModel } from './categories.interface'

const categorySchema = new Schema<TCategory>(
  {
    title: {
      type: String,
      required: true,
    },
    logo: {
      type: String,
      required: true,
    },
    listingCount: {
      type: Number,
      default: 0,
    },
    isTreading: {
      type: Boolean,
      default: false, 
    },
  },
  {
    timestamps: true,
  },
)

export const Category = model<TCategory, TCategoryModel>(
  'Category',
  categorySchema,
)
