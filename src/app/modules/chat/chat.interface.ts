import { Model, Types } from 'mongoose'
import { TChatType } from './chat.constants'

export interface TChat {
  _id?: Types.ObjectId
  type: TChatType
  name?: string
  image?: string
  project?: Types.ObjectId
  participants: Types.ObjectId[]
  status: string
}

export type TChatModel = Model<TChat, Record<string, unknown>>
