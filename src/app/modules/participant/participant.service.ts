import httpStatus from 'http-status'
import QueryBuilder from '../../builder/QueryBuilder'
import AppError from '../../errors/AppError'
import { TParticipant } from './participant.interface'
import { User } from '../user/user.model'
import { Participant } from './participant.models'
import { getRequesterRole, notifyChatParticipants } from './participant.utils'
import { getIO } from '../../../socket'
import { Chat } from '../chat/chat.models'
import { TParticipantStatus } from './participant.constants'

const addParticipant = async (payload: TParticipant, requesterId: string) => {
  const { chat, user, role = 'member' } = payload

  // Check chat exists
  const chatDoc = await Chat.findById(chat)
  if (!chatDoc || chatDoc?.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'Chat not found')

  // Check user exists
  const userDoc = await User.findById(user)
  if (!userDoc || userDoc?.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'User not found')

  // Check already exists
  const existing = await Participant.findOne({ chat, user })
  if (existing)
    throw new AppError(httpStatus.CONFLICT, 'User is already a participant')

  // Permission: only owner/admin/moderator can add (optional strict check)
  const requesterRole = await getRequesterRole(chat as any, requesterId)
  if (!requesterRole || !['planer', 'vendor'].includes(requesterRole)) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only planer and vendor can add participants',
    )
  }

  const participant = await Participant.create({
    chat,
    user,
    role,
  })

  // Emit real-time event
  const io = getIO()
  io.to(chat.toString()).emit('participant:added', participant)

  return participant
}

// Get all messages
const getChatParticipants = async (
  query: Record<string, any>,
  chatId: string,
) => {
  const participantsModel = new QueryBuilder(
    Participant.find({
      chat: chatId,
      isDeleted: false,
    }).populate([
      {
        path: 'user',
        select: 'name photoUrl',
      },
    ]),
    query,
  )
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await participantsModel.modelQuery
  const meta = await participantsModel.countTotal()

  return {
    data,
    meta,
  }
}

// Update messages
const updateParticipant = async (
  participantId: string,
  data: { status?: TParticipantStatus },
  requesterId: string,
) => {
  const { status } = data

  const participant = await Participant.findById(participantId)
  if (!participant)
    throw new AppError(httpStatus.NOT_FOUND, 'Participant not found')

  // Permission check: requester must be owner/admin/moderator in the room
  const requesterParticipant = await Participant.findOne({
    chat: participant.chat,
    user: requesterId,
    isDeleted: false,
  })

  if (!requesterParticipant) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not a participant in this chat',
    )
  }

  const allowedRoles = ['planer', 'vendor', 'user']
  if (!allowedRoles.includes(requesterParticipant.role)) {
    throw new AppError(httpStatus.FORBIDDEN, 'Insufficient permissions')
  }

  const result = await Participant.findByIdAndUpdate(
    participantId,
    { status },
    { new: true },
  )
  if (!result) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to update participant',
    )
  }

  // Emit real-time update
  const io = getIO()
  io.to(participant.chat.toString()).emit('participant:updated', result)

  // 6. Send push notification to other active participants (exclude actor)
  if (status) {
    await notifyChatParticipants(participant.chat, requesterId, status, 'bookings')
  }

  return result
}

const removeParticipant = async (
  participantId: string,
  requesterId: string,
) => {
  const participant = await Participant.findById(participantId)
  if (!participant)
    throw new AppError(httpStatus.NOT_FOUND, 'Participant not found')

  // Permission check
  const requester = await Participant.findOne({
    chat: participant.chat,
    user: requesterId,
    isDeleted: false,
  })

  if (!requester || !['planer'].includes(requester.role)) {
    throw new AppError(httpStatus.FORBIDDEN, 'Insufficient permissions')
  }
  // Prevent kicking owner
  if (participant.role === 'planer') {
    throw new AppError(httpStatus.FORBIDDEN, 'Cannot remove room owner')
  }

  await participant.deleteOne()

  // Emit event
  const io = getIO()
  io.to(participant.chat.toString()).emit('participant:removed', {
    userId: participant.user,
    chatId: participant.chat,
  })

  return { message: 'Participant removed successfully' }
}

export const ParticipantsService = {
  addParticipant,
  getChatParticipants,
  updateParticipant,
  removeParticipant,
}
