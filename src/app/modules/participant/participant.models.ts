import { Schema, Types, model } from 'mongoose'
import { TParticipant, TParticipantModel } from './participant.interface'
import { PARTICIPANT_ROLE, PARTICIPANT_STATUS } from './participant.constants'

const participantSchema = new Schema<TParticipant>(
  {
    chat: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(PARTICIPANT_ROLE),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PARTICIPANT_STATUS),
      default: PARTICIPANT_STATUS.active,
    },
  },
  {
    timestamps: true,
  },
)

export const Participant = model<TParticipant, TParticipantModel>(
  'Participant',
  participantSchema,
)
