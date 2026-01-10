import { Model, Types } from 'mongoose'

export enum SEARCH_MODEL_TYPE {
  User = 'User',
  Service = 'Service',
  Category = 'Category',
}

export type TSearchHistory = {
  _id?: string
  userId: Types.ObjectId
  modelType: SEARCH_MODEL_TYPE
  refId: Types.ObjectId
}

export type TSearchHistoryModel = Model<TSearchHistory, Record<string, unknown>>
