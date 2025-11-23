import { Schema, model } from 'mongoose'
import { TSearchHistory, TSearchHistoryModel } from './searchHistory.interface'

const searchHistorySchema = new Schema<TSearchHistory>(
  {
   user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    keyword: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
)

export const SearchHistory = model<TSearchHistory, TSearchHistoryModel>(
  'SearchHistory',
  searchHistorySchema,
)
