import { Model, Types } from 'mongoose'
import { TChatType } from './chat.constants'

export interface TChat {
  _id?: Types.ObjectId
  type: TChatType
  project?: Types.ObjectId | null
  name?: string
  image?: string
  status: string
  isDeleted: boolean
}

export type TChatModel = Model<TChat, Record<string, unknown>>
