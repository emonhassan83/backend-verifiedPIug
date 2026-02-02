import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import httpStatus from 'http-status';
import { Types } from 'mongoose';
import getUserDetailsFromToken from './app/utils/vaildateUserFromToken';
import AppError from './app/errors/AppError';
import { callbackFn } from './app/utils/CallbackFn';
import { Chat } from './app/modules/chat/chat.models';
import { Participant } from './app/modules/participant/participant.models';
import { Message } from './app/modules/messages/messages.models';
import { chatService } from './app/modules/chat/chat.service';

let ioInstance: Server | null = null;

const initializeSocketIO = (server: HttpServer) => {
  ioInstance = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Track online users globally and per chat
  const globalOnline = new Set<string>();
  const onlineInChat = new Map<string, Set<string>>(); // chatId → Set<userId>

  ioInstance.on('connection', async (socket: Socket) => {
    console.log('Client connected:', socket.id);

    try {
      // 1. Authenticate user
      const token = socket.handshake.auth?.token || socket.handshake.headers?.token;
      let user: any;
      try {
        user = await getUserDetailsFromToken(token);
        if (!user) throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid token');
      } catch (err) {
        console.error('Authentication failed:', err);
        socket.disconnect();
        return;
      }

      const userId = user._id.toString();
      socket.data.user = user;

      // 2. Join personal room for notifications & chat list
      socket.join(`user:${userId}`);
      globalOnline.add(userId);

      // 3. Auto-join all chats (private + group) this user is part of
      const userParticipants = await Participant.find({
        user: userId,
        isDeleted: false,
        status: 'active',
      }).select('chat');

      const joinedChats: string[] = [];

      userParticipants.forEach((p) => {
        const chatId = p.chat.toString();
        socket.join(`chat:${chatId}`);
        joinedChats.push(chatId);

        if (!onlineInChat.has(chatId)) onlineInChat.set(chatId, new Set());
        onlineInChat.get(chatId)!.add(userId);

        ioInstance!.to(`chat:${chatId}`).emit('chat:online-count', {
          chatId,
          count: onlineInChat.get(chatId)!.size,
        });
      });

      ioInstance!.emit('onlineUser', globalOnline.size);

      // =============================================
      // EVENT: my-chat-list (all private + group chats)
      // =============================================
      socket.on('my-chat-list', async (_, callback) => {
        try {
          const chatList = await chatService.getMyChatList(userId, {});
          const eventName = `chat-list::${userId}`;
          ioInstance!.to(`user:${userId}`).emit(eventName, chatList);
          callbackFn(callback, { success: true, data: chatList });
        } catch (err: any) {
          callbackFn(callback, { success: false, message: err.message });
        }
      });

      // =============================================
      // EVENT: send-message (private or group)
      // =============================================
      socket.on('send-message', async (payload, callback) => {
        try {
          const { chatId, text, imageUrl = [], receiver, replyTo } = payload;

          if (!chatId || !text?.trim()) {
            return callbackFn(callback, { success: false, message: 'chatId and text required' });
          }

          // Check if user is active participant
          const participant = await Participant.findOne({
            chat: chatId,
            user: userId,
            isDeleted: false,
            status: 'active',
          });

          if (!participant) {
            throw new AppError(httpStatus.FORBIDDEN, 'You cannot send messages in this chat');
          }

          const messageData: any = {
            chat: chatId,
            sender: userId,
            text,
            imageUrl,
            replyTo: replyTo || null,
          };

          // Private chat → receiver required
          const chat = await Chat.findById(chatId);
          if (chat?.type === 'private') {
            if (!receiver) throw new AppError(httpStatus.BAD_REQUEST, 'receiver required for private chat');
            messageData.receiver = receiver;
          }

          const message = await Message.create(messageData);

          const populated = await Message.findById(message._id)
            .populate('sender', 'username photoUrl email')
            .populate('receiver', 'username photoUrl email');

          // Emit to chat room
          ioInstance!.to(`chat:${chatId}`).emit('new-message', populated);

          // Update chat list for all participants
          const chatMembers = await Participant.find({ chat: chatId, isDeleted: false }).select('user');
          for (const member of chatMembers) {
            const memberId = member.user.toString();
            const list = await chatService.getMyChatList(memberId, {});
            ioInstance!.to(`user:${memberId}`).emit(`chat-list::${memberId}`, list);
          }

          // Update unread count per user
          for (const member of chatMembers) {
            const memberId = member.user.toString();
            const unreadInChat = await Message.countDocuments({
              chat: chatId,
              sender: { $ne: new Types.ObjectId(memberId) },
              seen: false,
            });
            ioInstance!.to(`user:${memberId}`).emit(`unread-chat::${chatId}`, unreadInChat);
          }

          callbackFn(callback, {
            statusCode: httpStatus.OK,
            success: true,
            message: 'Message sent successfully',
            data: populated,
          });
        } catch (err: any) {
          console.error('send-message error:', err);
          callbackFn(callback, { success: false, message: err.message });
        }
      });

      // =============================================
      // EVENT: Typing / Stop Typing
      // =============================================
      socket.on('typing', ({ chatId }) => {
        if (!chatId) return;
        socket.to(`chat:${chatId}`).emit('typing', {
          userId,
          username: user.username || user.name || 'User',
        });
      });

      socket.on('stopTyping', ({ chatId }) => {
        if (!chatId) return;
        socket.to(`chat:${chatId}`).emit('stopTyping', { userId });
      });

      // =============================================
      // EVENT: Seen messages in a chat
      // =============================================
      socket.on('seen', async ({ chatId }, callback) => {
        if (!chatId) {
          return callbackFn(callback, { success: false, message: 'chatId required' });
        }

        try {
          await Message.updateMany(
            {
              chat: chatId,
              sender: { $ne: userId },
              seen: false,
            },
            { seen: true }
          );

          // Update chat list & unread for all participants
          const chatMembers = await Participant.find({ chat: chatId, isDeleted: false }).select('user');
          for (const member of chatMembers) {
            const memberId = member.user.toString();
            const list = await chatService.getMyChatList(memberId, {});
            ioInstance!.to(`user:${memberId}`).emit(`chat-list::${memberId}`, list);

            const unread = await Message.countDocuments({
              chat: chatId,
              sender: { $ne: new Types.ObjectId(memberId) },
              seen: false,
            });
            ioInstance!.to(`user:${memberId}`).emit(`unread-chat::${chatId}`, unread);
          }

          callbackFn(callback, { success: true });
        } catch (err: any) {
          callbackFn(callback, { success: false, message: err.message });
        }
      });

      // =============================================
      // EVENT: Disconnect
      // =============================================
      socket.on('disconnect', () => {
        joinedChats.forEach((chatId) => {
          const users = onlineInChat.get(chatId);
          if (users) {
            users.delete(userId);
            ioInstance!.to(`chat:${chatId}`).emit('chat:online-count', {
              chatId,
              count: users.size || 0,
            });
          }
        });

        globalOnline.delete(userId);
        ioInstance!.emit('onlineUser', globalOnline.size);

        console.log('User disconnected:', userId);
      });
    } catch (err) {
      console.error('Connection error:', err);
      socket.disconnect();
    }
  });

  return ioInstance;
};

/**
 * Get Socket.IO instance from anywhere in the app
 */
export const getIO = (): Server => {
  if (!ioInstance) {
    throw new Error('Socket.IO has not been initialized yet. Call initializeSocketIO first.');
  }
  return ioInstance;
};

export default initializeSocketIO;