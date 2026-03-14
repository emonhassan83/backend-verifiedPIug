import { Schema, model } from 'mongoose'
import { modelType, TChat, TChatModel } from './chat.interface'
import { CHAT_STATUS } from './chat.constants'

const chatSchema = new Schema<TChat>(
  {
    modelType: {
      type: String,
      enum: Object.values(modelType),
    },
    reference: {
      type: Schema.Types.ObjectId,
      refPath: 'modelType',
      default: null,
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
      default: CHAT_STATUS.active,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
)

export const Chat = model<TChat, TChatModel>('Chat', chatSchema)
