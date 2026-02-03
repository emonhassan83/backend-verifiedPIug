import { model, Schema } from 'mongoose'
import { TReviews, TReviewsModules } from './review.interface'

const reviewsSchema = new Schema<TReviews>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },

    ratings: {
      communicationSkills: { type: Number, min: 1, max: 5, required: true },
      professionalism: { type: Number, min: 1, max: 5, required: true },
      serviceQuality: { type: Number, min: 1, max: 5, required: true },
    },

    reactions: { type: String, trim: true },
    review: { type: String, required: true, trim: true },
    overallRating: { type: Number, min: 1, max: 5, required: true },
  },
  { timestamps: true },
)

export const Reviews = model<TReviews, TReviewsModules>('Review', reviewsSchema)
