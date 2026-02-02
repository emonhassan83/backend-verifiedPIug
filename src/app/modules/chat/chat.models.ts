import { Schema, model } from 'mongoose'
import { TChat, TChatModel } from './chat.interface'
import { CHAT_STATUS, CHAT_TYPE } from './chat.constants'

const chatSchema = new Schema<TChat>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: false,
    },
    type: {
      type: String,
      enum: Object.values(CHAT_TYPE),
      required: false,
    },
    name: {
      type: String,
      required: false,
    },
    image: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: Object.values(CHAT_STATUS),
      default: CHAT_STATUS.accepted,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
)

export const Chat = model<TChat, TChatModel>('Chat', chatSchema)
