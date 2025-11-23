import { Model, Types } from 'mongoose'

export interface TTask {
  _id?: string
  project: Types.ObjectId
  title: string
  date: string
  isCompleted: boolean
}

export type TTaskModel = Model<TTask, Record<string, unknown>>
