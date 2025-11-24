import { Model } from 'mongoose'
import { TDurationType, TPackageType } from './package.constant'

export type TPackage = {
  _id?: string
  title: string
  type: TPackageType
  billingCycle: TDurationType
  description: string[]
  price: number
  planCode: string
  popularity: number
  isDeleted: boolean
}

export type TPackageModel = Model<TPackage, Record<string, unknown>>
