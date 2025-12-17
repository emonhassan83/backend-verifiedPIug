import { Router } from 'express'
import { PortfolioController } from './portfolio.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import multer, { memoryStorage } from 'multer'
import parseData from '../../middleware/parseData'

const router = Router()
const storage = memoryStorage()
const upload = multer({ storage })

router.post(
  '/',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  upload.fields([{ name: 'files', maxCount: 12 }]),
  parseData(),
  PortfolioController.insertIntoDB,
)

router.get('/user/:userId', PortfolioController.getUsersPortfolio)

router.get(
  '/',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  PortfolioController.getAllIntoDB,
)

router.delete(
  '/:id',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  PortfolioController.deleteAIntoDB,
)

export const PortfolioRoutes = router
