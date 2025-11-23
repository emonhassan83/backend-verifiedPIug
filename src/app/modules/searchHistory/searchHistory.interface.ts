import { Model, Types } from 'mongoose'

export interface TSearchHistory {
  _id?: string
  user: Types.ObjectId
  keyword: string
}

export type TSearchHistoryModel = Model<TSearchHistory, Record<string, unknown>>
