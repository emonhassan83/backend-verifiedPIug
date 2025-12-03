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
  auth(USER_ROLE.admin),
  upload.fields([{ name: 'files', maxCount: 10 }]),
  parseData(),
  FileController.insertIntoDB,
)

router.get('/project/:projectId', FileController.getAllIntoDB)

router.delete('/:id', auth(USER_ROLE.admin), FileController.deleteAIntoDB)

export const FileRoutes = router
