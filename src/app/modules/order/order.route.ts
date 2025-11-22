import { Router } from 'express'
import { ServiceController } from './order.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import zodValidationRequest from '../../middleware/validateRequest'
import { ServiceValidation } from './order.validation'
import multer, { memoryStorage } from 'multer'
import parseData from '../../middleware/parseData'

const router = Router()
const storage = memoryStorage()
const upload = multer({ storage })

router.post(
  '/',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  upload.fields([{ name: 'files', maxCount: 10 }]),
  parseData(),
  zodValidationRequest(ServiceValidation.createValidationSchema),
  ServiceController.insertIntoDB,
)

router.patch(
  '/status/:id',
  auth(USER_ROLE.admin),
  zodValidationRequest(ServiceValidation.changeStatusValidationSchema),
  ServiceController.changeStatus,
)

router.put(
  '/:id',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  upload.fields([{ name: 'files', maxCount: 10 }]),
  parseData(),
  zodValidationRequest(ServiceValidation.updateValidationSchema),
  ServiceController.updateAIntoDB,
)

router.get('/active', ServiceController.getActiveServices)
router.get(
  '/my-services',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  ServiceController.getMyServices,
)

router.get('/user/:userId', ServiceController.getUserServices)
router.get('/:id', ServiceController.getAIntoDB)

router.get('/', auth(USER_ROLE.admin), ServiceController.getAllIntoDB)

router.delete(
  '/:id',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  ServiceController.deleteAIntoDB,
)

export const ServiceRoutes = router
