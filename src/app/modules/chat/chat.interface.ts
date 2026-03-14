import { Model, Types } from 'mongoose'
import { TChatStatus } from './chat.constants'

export enum modelType {
  User = 'User',
  Order = 'Order',
  Project = 'Project'
}

interface TParticipant {
  user: Types.ObjectId
}

export interface TChat {
  _id?: Types.ObjectId
  modelType: modelType
  reference?: Types.ObjectId | null
  name?: string
  image?: string
  participants?: TParticipant[]
  status: TChatStatus
  isDeleted: boolean
}

export type TChatModel = Model<TChat, Record<string, unknown>>
