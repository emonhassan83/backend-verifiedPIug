import { Model, Types } from 'mongoose'

export type TFavorite = {
  user: Types.ObjectId
  service: Types.ObjectId
}

export type TFavoriteModel = Model<TFavorite, Record<string, unknown>>
