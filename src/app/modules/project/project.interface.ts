import { Model, Types } from 'mongoose'
import { TProjectStatus } from './project.constants'

export interface TProject {
  _id?: string
  author: Types.ObjectId
  client: Types.ObjectId
  order: Types.ObjectId
  budget: number
  expense: number
  received: number
  vendorCount: number
  status: TProjectStatus
  isDeleted?: boolean
}

export type TProjectModel = Model<TProject, Record<string, unknown>>
