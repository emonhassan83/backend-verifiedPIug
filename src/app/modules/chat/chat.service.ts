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

  if (!participants || participants.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Participants are required')
  }

  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User not found')
  }

  // ✅ payload এ শুধু 1 জনের id আসবে (other user)
  const otherUserId = (participants[0] as any).user
    ? (participants[0] as any).user.toString()
    : participants[0].toString()

  // Other user exists check
  const otherUser = await User.findById(otherUserId)
  if (!otherUser || otherUser.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Participant user not found')
  }

  // ✅ Duplicate private chat check
  // ✅ Robust duplicate check
  if (restPayload.modelType === modelType.User) {
    // current user এর সব User type chat ids
    const myChats = await Participant.distinct('chat', { user: userId })

    // other user এর সব User type chat ids
    const otherChats = await Participant.distinct('chat', { user: otherUserId })

    // দুজনের common chat ids
    const myChatStrings = myChats.map((id) => id.toString())
    const otherChatStrings = otherChats.map((id) => id.toString())
    const commonChatIds = myChats.filter((id) =>
      otherChatStrings.includes(id.toString()),
    )

    if (commonChatIds.length > 0) {
      // common chat এর মধ্যে User type chat আছে কিনা check করো
      const existingChat = await Chat.findOne({
        _id: { $in: commonChatIds },
        modelType: modelType.User,
        isDeleted: false,
      })

      if (existingChat) {
        return existingChat // ✅ existing chat return করো
      }
    }
  }

  // Create chat
  const result = await Chat.create(restPayload)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Chat creation failed')
  }

  // ✅ শুধু দুজনকে add করো: current user + other user
  await Participant.insertMany([
    {
      chat: result._id,
      user: userId,
      role: PARTICIPANT_ROLE.user,
      status: PARTICIPANT_STATUS.active,
    },
    {
      chat: result._id,
      user: otherUserId,
      role: PARTICIPANT_ROLE.user,
      status: PARTICIPANT_STATUS.active,
    },
  ])

  return result
}

// Get my chat list
const getMyChatList = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const { searchTerm, ...restQuery } = query

  const myParticipations = await Participant.find({
    user: new Types.ObjectId(userId),
    status: PARTICIPANT_STATUS.active,
  }).select('chat')

  let myChatIds = myParticipations.map((p) => p.chat)

  if (myChatIds.length === 0) {
    return {
      meta: { total: 0, page: 1, limit: 10, totalPage: 1 },
      data: [],
    }
  }

  if (searchTerm) {
    const searchRegex = new RegExp(searchTerm as string, 'i')

    // 1. modelType: Order/Project → chat name দিয়ে search
    const chatsByName = await Chat.distinct('_id', {
      _id: { $in: myChatIds },
      modelType: { $in: [modelType.Order, modelType.Project] },
      name: { $regex: searchRegex },
      isDeleted: false,
    })

    // 2. modelType: User → participant name দিয়ে search
    const matchingUsers = await User.distinct('_id', {
      $or: [
        { name: { $regex: searchRegex } },
      ],
      isDeleted: false,
    })

    // User type chat এর মধ্যে matching participant আছে কিনা
    const userTypeChats = await Chat.distinct('_id', {
      _id: { $in: myChatIds },
      modelType: modelType.User,
      isDeleted: false,
    })

    const chatsByParticipantName = await Participant.distinct('chat', {
      chat: { $in: userTypeChats },
      user: { $in: matchingUsers },
      status: PARTICIPANT_STATUS.active,
    })

    // দুটো merge করো
    const matchedChatIds = [
      ...new Set([
        ...chatsByName.map((id) => id.toString()),
        ...chatsByParticipantName.map((id) => id.toString()),
      ]),
    ]

    myChatIds = myChatIds.filter((id) =>
      matchedChatIds.includes(id.toString())
    )

    if (myChatIds.length === 0) {
      return {
        meta: { total: 0, page: 1, limit: 10, totalPage: 1 },
        data: [],
      }
    }
  }

  const baseQuery = Chat.find({
    _id: { $in: myChatIds },
    isDeleted: false,
    status: CHAT_STATUS.active,
  })

  const queryBuilder = new QueryBuilder(baseQuery, restQuery)
  queryBuilder.filter()
  queryBuilder.sort()
  queryBuilder.paginate()
  queryBuilder.fields()

  const chats = await queryBuilder.modelQuery

  const enriched = await Promise.all(
    chats.map(async (chat) => {
      const [participants, lastMessage, unreadCount] = await Promise.all([
        Participant.find({
          chat: chat._id,
          status: PARTICIPANT_STATUS.active,
        }).populate('user', 'name photoUrl'),

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
  })
    .populate('user', 'name photoUrl')
    .select('user role status')

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
