import { Types } from 'mongoose';
import { Participant } from './participant.models'
import { PARTICIPANT_STATUS, TParticipantStatus } from './participant.constants';
import { canSendNotification, TNotifyCategory } from '../notification/notification.utils';
import { sendNotification } from '../../utils/sentNotification';
import { modeType } from '../notification/notification.interface';

// Re-use or define this helper (you already have it)
export const buildChatStatusMessage = (
  status: keyof typeof PARTICIPANT_STATUS,
): { message: string; description: string } => {
  let message = 'Participant status updated';
  let description = '';

  switch (status) {
    case 'blocked':
      description = 'You have been blocked from this chat.';
      break;
    case 'locked':
      description = 'This chat has been locked for you.';
      break;
    case 'active':
      description = 'You are now active in this chat again.';
      break;
    default:
      description = 'Your status in this chat has changed.';
  }

  return { message, description };
};

/**
 * Notify all active participants (except actor) about participant status change
 */
export const notifyChatParticipants = async (
  chatId: Types.ObjectId,
  actorId: string | Types.ObjectId,
  status: TParticipantStatus,
  category: TNotifyCategory,
): Promise<void> => {
  const participants = await Participant.find({
    chat: chatId,
    status: 'active',
    user: { $ne: actorId },
    isDeleted: false,
  })
    .lean()
    .populate({
      path: 'user',
      select: '_id fcmToken notifySettings isDeleted status',
    });

  if (!participants.length) return;

  const { message, description } = buildChatStatusMessage(status);

  const tokens: string[] = [];
  const receivers: Types.ObjectId[] = [];

  for (const p of participants) {
    const user = p.user as any;
    if (
      !user ||
      user.isDeleted ||
      user.status !== 'active' ||
      !user.fcmToken ||
      !canSendNotification(user, category)
    ) {
      continue;
    }

    tokens.push(user.fcmToken);
    receivers.push(user._id);
  }

  if (!tokens.length) return;

  // Send notifications in parallel
  await Promise.allSettled(
    tokens.map((token, i) =>
      sendNotification([token], {
        receiver: receivers[i],
        reference: chatId,
        message,
        description,
        model_type: modeType.Chat,
      })
    )
  );
};

export const getRequesterRole = async (roomId: string, userId: string) => {
  const participant = await Participant.findOne({
    room: roomId,
    user: userId,
    isDeleted: false,
  })
  return participant?.role || null
}
