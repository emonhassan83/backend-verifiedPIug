import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import httpStatus from 'http-status'
import { Types } from 'mongoose'
import getUserDetailsFromToken from './app/utils/vaildateUserFromToken'
import AppError from './app/errors/AppError'
import { callbackFn } from './app/utils/CallbackFn'
import { Participant } from './app/modules/participant/participant.models'
import { Chat } from './app/modules/chat/chat.models'
import { Message } from './app/modules/messages/messages.models'
import { chatService } from './app/modules/chat/chat.service'
import { USER_STATUS } from './app/modules/user/user.constant'

let ioInstance: Server | null = null

const initializeSocketIO = (server: HttpServer) => {
  ioInstance = new Server(server, {
    cors: { origin: '*', credentials: true },
  })

  const globalOnline = new Set<string>()
  const onlineInChat = new Map<string, Set<string>>()

  ioInstance.on('connection', async (socket: Socket) => {
    console.log('connected:', socket.id)

    try {
      const token =
        socket.handshake.auth?.token || socket.handshake.headers?.token
      let user: any
      try {
        user = await getUserDetailsFromToken(token)
        if (!user) throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid token')
      } catch (err) {
        console.log(err)
        socket.disconnect()
        return
      }

      const userId = user._id.toString()
      socket.data.user = user

      socket.join(`user:${userId}`)
      globalOnline.add(userId)

      // Auto-join all active chats
      const userChats = await Participant.find({
        user: userId,
        isDeleted: false,
        status: USER_STATUS.active,
      }).select('chat')

      userChats.forEach((p) => {
        const chatId = p.chat.toString()
        socket.join(`chat:${chatId}`)

        if (!onlineInChat.has(chatId)) onlineInChat.set(chatId, new Set())
        onlineInChat.get(chatId)!.add(userId)

        ioInstance!.to(`chat:${chatId}`).emit('chat:online-count', {
          chatId,
          count: onlineInChat.get(chatId)!.size,
        })
      })

      ioInstance!.emit('onlineUser', globalOnline.size)

      // =============================================
      // EVENT: my-chat-list (private + group)
      // =============================================
      socket.on('my-chat-list', async (_, callback) => {
        try {
          const chatList = await chatService.getMyChatList(userId, {})
          const eventName = `chat-list::${userId}`
          ioInstance!.to(`user:${userId}`).emit(eventName, chatList)
          callbackFn(callback, { success: true, data: chatList })
        } catch (err: any) {
          callbackFn(callback, { success: false, message: err.message })
        }
      })

      // =============================================
      // EVENT: send-message (private or group)
      // =============================================
      socket.on('send-message', async (payload, callback) => {
        try {
          const { chatId, text, imageUrl = [], receiver, replyTo } = payload

          if (!chatId || !text?.trim()) {
            return callbackFn(callback, {
              success: false,
              message: 'chatId and text required',
            })
          }

          const participant = await Participant.findOne({
            chat: chatId,
            user: userId,
            isDeleted: false,
            status: 'active',
          })
          if (!participant) {
            throw new AppError(
              httpStatus.FORBIDDEN,
              'You cannot send messages here',
            )
          }

          const chat = await Chat.findById(chatId)
          if (!chat) throw new AppError(httpStatus.NOT_FOUND, 'Chat not found')

          const messageData: any = {
            chat: chatId,
            sender: userId,
            text,
            imageUrl,
            replyTo: replyTo || null,
          }

          if (chat.type === 'private') {
            if (!receiver)
              throw new AppError(
                httpStatus.BAD_REQUEST,
                'receiver required for private chat',
              )
            messageData.receiver = receiver
          }

          const message = await Message.create(messageData)

          const populated = await Message.findById(message._id)
            .populate('sender', 'name photoUrl')
            .populate('receiver', 'name photoUrl')

          ioInstance!.to(`chat:${chatId}`).emit('new-message', populated)

          const chatMembers = await Participant.find({
            chat: chatId,
            isDeleted: false,
          }).select('user')
          for (const member of chatMembers) {
            const memberId = member.user.toString()
            const list = await chatService.getMyChatList(memberId, {})
            ioInstance!
              .to(`user:${memberId}`)
              .emit(`chat-list::${memberId}`, list)
          }

          callbackFn(callback, {
            statusCode: httpStatus.OK,
            success: true,
            message: 'Message sent successfully',
            data: populated,
          })
        } catch (err: any) {
          callbackFn(callback, { success: false, message: err.message })
        }
      })

      // Typing events
      socket.on('typing', ({ chatId }) => {
        if (!chatId) return
        socket.to(`chat:${chatId}`).emit('typing', {
          userId,
          username: user.username || user.name || 'User',
        })
      })

      socket.on('stopTyping', ({ chatId }) => {
        if (!chatId) return
        socket.to(`chat:${chatId}`).emit('stopTyping', { userId })
      })

      // Seen messages
      socket.on('seen', async ({ chatId }, callback) => {
        if (!chatId)
          return callbackFn(callback, {
            success: false,
            message: 'chatId required',
          })

        try {
          await Message.updateMany(
            {
              chat: chatId,
              sender: { $ne: userId },
              seen: false,
            },
            { seen: true },
          )

          const chatMembers = await Participant.find({
            chat: chatId,
            isDeleted: false,
          }).select('user')
          for (const member of chatMembers) {
            const memberId = member.user.toString()
            const list = await chatService.getMyChatList(memberId, {})
            ioInstance!
              .to(`user:${memberId}`)
              .emit(`chat-list::${memberId}`, list)

            const unread = await Message.countDocuments({
              chat: chatId,
              sender: { $ne: new Types.ObjectId(memberId) },
              seen: false,
            })
            ioInstance!
              .to(`user:${memberId}`)
              .emit(`unread-chat::${chatId}`, unread)
          }

          callbackFn(callback, { success: true })
        } catch (err: any) {
          callbackFn(callback, { success: false, message: err.message })
        }
      })

      // Disconnect
      socket.on('disconnect', () => {
        userChats.forEach((p) => {
          const chatId = p.chat.toString()
          const users = onlineInChat.get(chatId)
          if (users) {
            users.delete(userId)
            ioInstance!.to(`chat:${chatId}`).emit('chat:online-count', {
              chatId,
              count: users.size || 0,
            })
          }
        })

        globalOnline.delete(userId)
        ioInstance!.emit('onlineUser', globalOnline.size)
      })
    } catch (err) {
      console.error('Connection error:', err)
      socket.disconnect()
    }
  })

  return ioInstance
}

export const getIO = (): Server => {
  if (!ioInstance) throw new Error('Socket.IO not initialized')
  return ioInstance
}

export default initializeSocketIO
