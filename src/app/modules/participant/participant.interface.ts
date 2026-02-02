import { Model, Types } from 'mongoose'
import { TParticipantRole, TParticipantStatus } from './participant.constants'

export interface TParticipant {
  _id?: Types.ObjectId
  chat: Types.ObjectId
  user: Types.ObjectId
  role: TParticipantRole
  status: TParticipantStatus
}

export type TParticipantModel = Model<TParticipant, Record<string, unknown>>
