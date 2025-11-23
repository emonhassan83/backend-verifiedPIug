import { Model, Types } from 'mongoose'

export interface TFile {
  _id?: string
  project: Types.ObjectId
  url: string
  fileSize: number
}

export type TFileModel = Model<TFile, Record<string, unknown>>
