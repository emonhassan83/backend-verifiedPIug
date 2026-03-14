import httpStatus from 'http-status'
import { modelType, TChat } from './chat.interface'
import AppError from '../../errors/AppError'
import { Chat } from './chat.models'
import { User } from '../user/user.model'
import { Message } from '../messages/messages.models'
import { Participant } from '../participant/participant.models'
import { Types } from 'mongoose'
import QueryBuilder from '../../builder/QueryBuilder'
import { CHAT_STATUS, TChatStatus } from './chat.constants'
import {
  PARTICIPANT_ROLE,
  PARTICIPANT_STATUS,
} from '../participant/participant.constants'
import { uploadToS3 } from '../../utils/s3'
import { notifyChatParticipants } from './chat.utils'

// Create chat
const createChat = async (payload: TChat, userId: string) => {
  const { participants, ...restPayload } = payload

  // Ensure participants exist
  if (participants && participants.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Participants are required for group chat',
    )
  }

  // Private chat special check
  if (restPayload.modelType === modelType.User && participants!.length !== 1) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Private chat must have exactly 1 participant',
    )
  }

  // Ensure owner exists
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User not found')
  }

  // Ensure participants' users exist
  const participantUserIds = participants!.map((p) => p.user)
  const existingUsers = await User.find({
    _id: { $in: participantUserIds },
    isDeleted: false,
  })
  if (existingUsers.length !== participantUserIds.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'One or more participant users do not exist or are deleted',
    )
  }

  // Create chat
  const result = await Chat.create(restPayload)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Chat creation failed')
  }

  // Add owner as participant
  if (participants && participants.length > 0) {
    const participantDocs = participants.map((participant) => ({
      chat: result._id,
      user: participant.user,
      role: PARTICIPANT_ROLE.user,
    }))
    await Participant.insertMany(participantDocs)
  }

  return result
}

// Get my chat list
const getMyChatList = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  // 1. এই user এর সব active chat ids বের করো
  const myParticipations = await Participant.find({
    user: new Types.ObjectId(userId),
    status: PARTICIPANT_STATUS.active,
  }).select('chat')

  const myChatIds = myParticipations.map((p) => p.chat)

  if (myChatIds.length === 0) {
    return {
      meta: { total: 0, page: 1, limit: 10, totalPage: 1 },
      data: [],
    }
  }

  // 2. সেই chat ids দিয়ে Chat find করো
  const baseQuery = Chat.find({
    _id: { $in: myChatIds },
    isDeleted: false,
    status: CHAT_STATUS.active,
  })

  const queryBuilder = new QueryBuilder(baseQuery, query)
  queryBuilder.filter()
  queryBuilder.sort()
  queryBuilder.paginate()
  queryBuilder.fields()

  const chats = await queryBuilder.modelQuery

  // 3. প্রতিটা chat এ participants, lastMessage, unreadCount যোগ করো
  const enriched = await Promise.all(
    chats.map(async (chat) => {
      const [participants, lastMessage, unreadCount] = await Promise.all([
        Participant.find({
          chat: chat._id,
          status: PARTICIPANT_STATUS.active,
        })
          .populate('user', 'name photoUrl')
          .select('user'),

        Message.findOne({ chat: chat._id })
          .sort({ createdAt: -1 })
          .populate('sender', 'name photoUrl'),

        Message.countDocuments({
          chat: chat._id,
          sender: { $ne: new Types.ObjectId(userId) },
          seen: false,
        }),
      ])

      return {
        ...chat.toObject(),
        participants,
        lastMessage,
        unreadCount,
      }
    }),
  )

  const meta = await queryBuilder.countTotal()

  return { meta, data: enriched }
}

// Get chat by ID
const getChatById = async (chatId: string, requestingUserId: string) => {
  const chat = await Chat.findById(chatId)
  if (!chat || chat?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Chat not found')
  }

  // Access check
  const isParticipant = await Participant.exists({
    chat: chatId,
    user: requestingUserId,
    status: PARTICIPANT_STATUS.active,
  })
  if (!isParticipant) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You do not have access to this room',
    )
  }

  // Participants fetch করো
  const participants = await Participant.find({
    chat: chatId,
    status: PARTICIPANT_STATUS.active,
  }).populate('user', 'name photoUrl').select('user role status')

  return {
    ...chat.toObject(),
    participants,
  }
}

// Update chat list
const updateChatList = async (
  id: string,
  payload: Partial<TChat>,
  file: Express.Multer.File | undefined,
  userId: string,
) => {
  const chat = await Chat.findById(id)
  if (!chat) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Chat not found')
  }

  // Ensure user in of the chat
  const isParticipant = await Participant.exists({
    chat: id,
    user: userId,
    isDeleted: false,
  })
  if (!isParticipant) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You do not have access to this chat',
    )
  }

  // upload image if provided
  if (file) {
    const imageUrl = await uploadToS3({
      file,
      fileName: `images/chat/image/${Math.floor(100000 + Math.random() * 900000)}`,
    })
    if (imageUrl) {
      payload.image = imageUrl
    }
  }

  const result = await Chat.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  })
  return result
}

// Update chat list
const updateChatStatus = async (
  id: string,
  payload: { status: TChatStatus },
  userId: string,
) => {
  const { status } = payload

  const chat = await Chat.findById(id)
  if (!chat) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Chat not found')
  }

  // Ensure user in of the chat
  const isParticipant = await Participant.exists({
    chat: id,
    user: userId,
    isDeleted: false,
  })
  if (!isParticipant) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You do not have access to this chat',
    )
  }

  const result = await Chat.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true },
  )

  // 🔔 Notify all participants
  await notifyChatParticipants(
    new Types.ObjectId(id),
    new Types.ObjectId(userId),
    payload.status,
    'bookings',
  )

  return result
}

// Delete chat list
const deleteChatList = async (id: string, userId: string) => {
  const chat = await Chat.findById(id)
  if (!chat) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Chat not found')
  }

  // Ensure user in of the chat
  const isParticipant = await Participant.exists({
    chat: id,
    user: userId,
    isDeleted: false,
  })
  if (!isParticipant) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You do not have access to this chat',
    )
  }

  const result = await Chat.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true, runValidators: true },
  )
  return result
}

export const chatService = {
  createChat,
  getMyChatList,
  getChatById,
  updateChatList,
  updateChatStatus,
  deleteChatList,
}
