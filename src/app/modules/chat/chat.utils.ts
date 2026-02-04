import { Types } from 'mongoose';
import { User } from '../user/user.model';
import { Participant } from '../participant/participant.models';
import { sendNotification } from '../../utils/sentNotification';
import { canSendNotification, TNotifyCategory } from '../notification/notification.utils';
import { modeType } from '../notification/notification.interface';
import { CHAT_STATUS } from './chat.constants';

// Type for status (using keyof typeof to stay type-safe with the enum)
type ChatStatusType = keyof typeof CHAT_STATUS;

/**
 * Builds notification message and description based on chat status change
 */
export const buildChatStatusMessage = (
  status: ChatStatusType,
): { message: string; description: string } => {
  let message = 'Chat status updated';
  let description = '';

  switch (status) {
    case CHAT_STATUS.locked:
      description = 'This chat has been locked. Messaging is disabled.';
      break;

    case CHAT_STATUS.blocked:
      description = 'This chat has been blocked by an administrator.';
      break;

    case CHAT_STATUS.archived:
      description = 'This chat has been archived.';
      break;

    case CHAT_STATUS.active:
      description = 'This chat is active again.';
      break;

    default:
      description = 'Chat status has been updated.';
  }

  return { message, description };
};

/**
 * Notifies all active participants (except the actor) about a chat status change
 * @param chatId - ID of the chat
 * @param actorId - ID of the user who triggered the status change (excluded from notification)
 * @param status - New chat status
 * @param category - Notification category for permission check
 */
export const notifyChatParticipants = async (
  chatId: Types.ObjectId,
  actorId: Types.ObjectId,
  status: ChatStatusType,
  category: TNotifyCategory,
): Promise<void> => {
  // Fetch only active participants excluding the actor
  const participants = await Participant.find({
    chat: chatId,
    status: 'active',
    user: { $ne: actorId },
  })
    .lean() // Performance: no Mongoose document overhead
    .populate({
      path: 'user',
      select: '_id fcmToken notifySettings isDeleted status',
    });

  if (!participants.length) {
    return;
  }

  const { message, description } = buildChatStatusMessage(status);

  const tokens: string[] = [];
  const notifyUsers: Types.ObjectId[] = [];

  // Filter valid recipients efficiently
  for (const participant of participants) {
    const user = participant.user as any; // Type assertion due to lean + populate

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
    notifyUsers.push(user._id);
  }

  if (!tokens.length) {
    return;
  }

  // Send notifications in parallel (faster)
  const notificationPromises = tokens.map((token, index) =>
    sendNotification([token], {
      receiver: notifyUsers[index],
      reference: chatId,
      message,
      description,
      model_type: modeType.Chat,
    })
  );

  // Wait for all notifications to complete (but don't block main flow on failure)
  await Promise.allSettled(notificationPromises);
};