import { Model, Types } from 'mongoose'

export interface TAssignProject {
  _id?: string
  project: Types.ObjectId
  vendor: Types.ObjectId
  vendorName: string
  vendorCategory: string
  vendorEmail: string
  vendorPhone: string
  quote: number
}

export type TAssignProjectModel = Model<TAssignProject, Record<string, unknown>>
