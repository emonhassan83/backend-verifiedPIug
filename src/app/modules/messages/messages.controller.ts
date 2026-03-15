import { Request, Response } from 'express'
import catchAsync from '../../utils/catchAsync'
import { messagesService } from './messages.service'
import sendResponse from '../../utils/sendResponse'
import { uploadToS3 } from '../../utils/s3'
import httpStatus from 'http-status'
import { Message } from './messages.models'
import AppError from '../../errors/AppError'
import { storeFile } from '../../utils/fileHelper'

const createMessages = catchAsync(async (req: Request, res: Response) => {
  const id = `${Math.floor(100000 + Math.random() * 900000)}${Date.now()}`
  req.body.id = id
  if (req?.file) {
    req.body.imageUrl = storeFile('messages', req?.file?.filename)
  }

  req.body.sender = req.user._id

  const result = await messagesService.createMessages(req.body)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Message sent successfully',
    data: result,
  })
})

// Get messages by chat ID
const getMessagesByChatId = catchAsync(async (req: Request, res: Response) => {
  const result = await messagesService.getMessagesByChatId(req.query, req.params.chatId)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Messages retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

// Get message by ID
const getMessagesById = catchAsync(async (req: Request, res: Response) => {
  const result = await messagesService.getMessagesById(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Message retrieved successfully',
    data: result,
  })
})

// Update message
const updateMessages = catchAsync(async (req: Request, res: Response) => {
  if (req.file) {
    const message = await Message.findById(req.params.id)
    if (!message) {
      throw new AppError(httpStatus.NOT_FOUND, 'Message not found')
    }
    const imageUrl = await uploadToS3({
      file: req.file,
      fileName: `images/messages/${message.chat}/${message.id}`,
    })

    req.body.imageUrl = imageUrl
  }

  const result = await messagesService.updateMessages(req.params.id, req.body)
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Message updated successfully',
    data: result,
  })
})

//seen messages
const seenMessage = catchAsync(async (req: Request, res: Response) => {
  const result = await messagesService.seenMessage(
    req.user._id,
    req.params.chatId,
  )

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Message seen successfully',
    data: result,
  })
})

// Delete message
const deleteMessages = catchAsync(async (req: Request, res: Response) => {
  const result = await messagesService.deleteMessages(req.params.id)
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Message deleted successfully',
    data: result,
  })
})

// delete messages by chat ID
const deleteMessagesByChatId = catchAsync(
  async (req: Request, res: Response) => {
    const result = await messagesService.deleteMessagesByChatId(
      req.params.chatId,
    )

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Messages deleted successfully',
      data: result,
    })
  },
)

export const messagesController = {
  createMessages,
  getMessagesByChatId,
  getMessagesById,
  updateMessages,
  deleteMessages,
  seenMessage,
  deleteMessagesByChatId,
}
