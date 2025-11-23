import { Model, Types } from 'mongoose'

export interface TReviews {
  _id?: Types.ObjectId
  user: Types.ObjectId
  author: Types.ObjectId
  service: Types.ObjectId
  order: Types.ObjectId
  ratings: {
    communicationSkills: number;
    professionalism: number;
    serviceQuality: number;
  };
  reactions: string;
  review: string
  overallRating: number
}

export type TReviewsModules = Model<TReviews, Record<string, unknown>>
