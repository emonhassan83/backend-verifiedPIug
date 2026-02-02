import { Model, Types } from 'mongoose'
import { TChatStatus, TChatType } from './chat.constants'

interface TParticipant {
  user: Types.ObjectId
}

export interface TChat {
  _id?: Types.ObjectId
  type: TChatType
  project?: Types.ObjectId | null
  name?: string
  image?: string
  participants?: TParticipant[]
  status: TChatStatus
  isDeleted: boolean
}

export type TChatModel = Model<TChat, Record<string, unknown>>
