import { Participant } from './participant.models'

export const getRequesterRole = async (roomId: string, userId: string) => {
  const participant = await Participant.findOne({
    room: roomId,
    user: userId,
    isDeleted: false,
  })
  return participant?.role || null
}
