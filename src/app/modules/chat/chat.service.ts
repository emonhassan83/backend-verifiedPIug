import httpStatus from 'http-status'
import { TChat } from './chat.interface'
import AppError from '../../errors/AppError'
import { Chat } from './chat.models'
import { User } from '../user/user.model'
import { Message } from '../messages/messages.models'
import { Participant } from '../participant/participant.models'
import { Types } from 'mongoose'
import QueryBuilder from '../../builder/QueryBuilder'
import { CHAT_TYPE, TChatStatus } from './chat.constants'
import { PARTICIPANT_ROLE } from '../participant/participant.constants'
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
  if (restPayload.type === CHAT_TYPE.private && participants!.length !== 1) {
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
  const baseQuery = Chat.find({ isDeleted: false }).populate({
    path: 'participants.user',
    select: 'name photoUrl role',
  })

  const queryBuilder = new QueryBuilder(baseQuery, query)

  // শুধু যেসব চ্যাটে ইউজার আছে
  queryBuilder.modelQuery = queryBuilder.modelQuery.find({
    'participants.user': new Types.ObjectId(userId),
    'participants.isDeleted': false,
  })

  queryBuilder.filter()
  queryBuilder.sort()
  queryBuilder.paginate()
  queryBuilder.fields()

  const chats = await queryBuilder.modelQuery

  // last message + unread count যোগ করা
  const enriched = await Promise.all(
    chats.map(async (chat) => {
      const lastMessage = await Message.findOne({ chat: chat._id })
        .sort({ createdAt: -1 })
        .populate('sender', 'name photoUrl')

      const unreadCount = await Message.countDocuments({
        chat: chat._id,
        sender: { $ne: new Types.ObjectId(userId) },
        seen: false,
      })

      return {
        ...chat.toObject(),
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
    isDeleted: false,
  })
  if (!isParticipant) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You do not have access to this room',
    )
  }

  return chat
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
    'service',
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
