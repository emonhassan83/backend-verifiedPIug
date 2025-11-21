import { Model, Types } from 'mongoose'

export interface TPortfolio {
  _id?: string
  author: Types.ObjectId
  url: string
}

export type TPortfolioModel = Model<TPortfolio, Record<string, unknown>>
