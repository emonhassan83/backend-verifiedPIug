import { Schema, model, Types } from 'mongoose'
import { TService, TServiceModel } from './service.interface'
import {
  PRICE_TYPE,
  SERVICE_AUTHORITY,
  SERVICE_STATUS,
} from './service.constants'

const serviceSchema = new Schema<TService>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authority: {
      type: String,
      enum: Object.keys(SERVICE_AUTHORITY),
      required: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
      required: true,
      default: [],
    },
    // Service areas (provinces with their center location)
    serviceAreas: [
      {
        name: { type: String, required: true }, // Province name: 'Gauteng', 'Western Cape'
        locationUrl: { type: String }, // Google map URL or any reference
        location: {
          type: { type: String, enum: ['Point'], default: 'Point' },
          coordinates: { type: [Number], required: true }, // [longitude, latitude]
        },
      },
    ],

    price: {
      type: Number,
      required: true,
    },
    priceType: {
      type: String,
      enum: Object.values(PRICE_TYPE),
      required: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: Object.values(SERVICE_STATUS),
      default: SERVICE_STATUS.pending,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    featuredAt: {
      type: Date,
    },
  },
  { timestamps: true },
)

serviceSchema.index({ location: '2dsphere' })

export const Service = model<TService, TServiceModel>('Service', serviceSchema)
