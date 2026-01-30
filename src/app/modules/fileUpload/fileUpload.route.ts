import { Router } from 'express'
import { FileController } from './fileUpload.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import multer, { memoryStorage } from 'multer'
import parseData from '../../middleware/parseData'

const router = Router()
const storage = memoryStorage()
const upload = multer({ storage })

router.post(
  '/',
  auth(USER_ROLE.planer),
  upload.fields([{ name: 'files', maxCount: 10 }]),
  parseData(),
  FileController.insertIntoDB,
)

router.get(
  '/project/:projectId',
  auth(USER_ROLE.planer),
  FileController.getAllIntoDB,
)

router.delete('/:id', auth(USER_ROLE.planer), FileController.deleteAIntoDB)

export const FileRoutes = router
