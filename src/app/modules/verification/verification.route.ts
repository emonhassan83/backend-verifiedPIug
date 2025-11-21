import { Router } from 'express'
import { VerificationController } from './verification.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import zodValidationRequest from '../../middleware/validateRequest'
import { VerificationValidation } from './verification.validation'
import multer, { memoryStorage } from 'multer'
import parseData from '../../middleware/parseData'

const router = Router()
const storage = memoryStorage()
const upload = multer({ storage })

router.post(
  '/',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  upload.fields([{ name: 'images', maxCount: 2 }]),
  parseData(),
  zodValidationRequest(VerificationValidation.createValidationSchema),
  VerificationController.insertIntoDB,
)

router.patch(
  '/status/:id',
  auth(USER_ROLE.admin),
  zodValidationRequest(VerificationValidation.updateValidationSchema),
  VerificationController.updateAIntoDB,
)

router.get('/:id', auth(USER_ROLE.admin), VerificationController.getAIntoDB)

router.get('/', auth(USER_ROLE.admin), VerificationController.getAllIntoDB)

router.delete(
  '/:id',
  auth(USER_ROLE.admin),
  VerificationController.deleteAIntoDB,
)

export const VerificationRoutes = router
