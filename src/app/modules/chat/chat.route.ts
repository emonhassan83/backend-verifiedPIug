import { Router } from 'express'
import { chatController } from './chat.controller'
import validateRequest from '../../middleware/validateRequest'
import { ChatValidation } from './chat.validation'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import parseData from '../../middleware/parseData'
import multer, { memoryStorage } from 'multer'

const router = Router()
const storage = memoryStorage()
const upload = multer({ storage })

router.post(
  '/',
  auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  validateRequest(ChatValidation.createValidation),
  chatController.createChat,
)

router.patch(
  '/status/:id',
  auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  validateRequest(ChatValidation.changeStatusValidation),
  chatController.updateChatStatus,
)

router.put(
  '/:id',
  auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  upload.single('image'),
  parseData(),
  validateRequest(ChatValidation.updateValidation),
  chatController.updateChat,
)

router.delete(
  '/:id',
  auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  chatController.deleteChat,
)

router.get(
  '/my-chats',
  auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  chatController.getMyChatList,
)

router.get(
  '/:id',
  auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  chatController.getChatById,
)

export const ChatRoutes = router
