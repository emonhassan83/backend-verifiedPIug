import { Schema, model } from 'mongoose'
import { SEARCH_MODEL_TYPE, TSearchHistory, TSearchHistoryModel } from './searchHistory.interface'

const searchHistoriesSchema = new Schema<TSearchHistory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    modelType: {
      type: String,
      enum: Object.values(SEARCH_MODEL_TYPE),
      required: true,
    },
    refId: { type: Schema.Types.ObjectId, ref: 'Deal', required: true },
  },
)

// SearchHistories Model
searchHistoriesSchema.index({ userId: 1, modelType: 1, refId: 1 }, { unique: true });

export const SearchHistory = model<TSearchHistory, TSearchHistoryModel>(
  'SearchHistory',
  searchHistoriesSchema,
)
