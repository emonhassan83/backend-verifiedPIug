import { Schema, model } from 'mongoose'
import { TMessages, TMessagesModel } from './messages.interface'

const messageSchema = new Schema<TMessages>(
  {
    text: { type: String, default: null },
    imageUrl: {
      type: [String],
      default: [],
    },
    seen: { type: Boolean, default: false },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false, // ← group chat-এর জন্য optional
    },
    chat: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Chat',
    },
  },
  { timestamps: true },
)

export const Message = model<TMessages, TMessagesModel>(
  'Messages',
  messageSchema,
)
