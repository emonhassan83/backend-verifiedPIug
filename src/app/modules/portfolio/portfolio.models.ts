import { Schema, model } from 'mongoose'
import { TPortfolio, TPortfolioModel } from './portfolio.interface'

const portfolioSchema = new Schema<TPortfolio>({
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  url: {
    type: String,
    required: true,
  },
})

export const Portfolio = model<TPortfolio, TPortfolioModel>(
  'Portfolio',
  portfolioSchema,
)
