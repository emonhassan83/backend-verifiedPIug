import { Router } from 'express'
import { messagesController } from './messages.controller'
import validateRequest from '../../middleware/validateRequest'
import { messagesValidation } from './messages.validation'
import multer, { memoryStorage } from 'multer'
import parseData from '../../middleware/parseData'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'

const router = Router()
const storage = memoryStorage()
const upload = multer({ storage })

router.post(
  '/send-messages',
  auth(USER_ROLE.user, USER_ROLE.vendor, USER_ROLE.planer),
  upload.single('image'),
  parseData(),
  validateRequest(messagesValidation.sendMessageValidation),
  messagesController.createMessages,
)

router.patch(
  '/seen/:chatId',
  auth(USER_ROLE.user, USER_ROLE.vendor, USER_ROLE.planer),
  messagesController.seenMessage,
)

router.put(
  '/:id',
  auth(USER_ROLE.user, USER_ROLE.vendor, USER_ROLE.planer),
  validateRequest(messagesValidation.updateMessageValidation),
  messagesController.updateMessages,
)

router.get(
  '/chat/:chatId',
  auth(USER_ROLE.user, USER_ROLE.vendor, USER_ROLE.planer),
  messagesController.getMessagesByChatId,
)

router.delete(
  '/chat/:chatId',
  auth(USER_ROLE.user, USER_ROLE.vendor, USER_ROLE.planer),
  messagesController.deleteMessagesByChatId,
)

router.delete(
  '/:id',
  auth(USER_ROLE.user, USER_ROLE.vendor, USER_ROLE.planer),
  messagesController.deleteMessages,
)

router.get(
  '/:id',
  auth(USER_ROLE.user, USER_ROLE.vendor, USER_ROLE.planer),
  messagesController.getMessagesById,
)

export const MessagesRoutes = router
