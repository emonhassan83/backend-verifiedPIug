import { Router } from 'express'
import { ServiceController } from './service.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import zodValidationRequest from '../../middleware/validateRequest'
import { ServiceValidation } from './service.validation'
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

router.patch(
  '/featured/:id',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  ServiceController.changeFeaturedService,
)

router.put(
  '/:id',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  upload.fields([{ name: 'files', maxCount: 10 }]),
  parseData(),
  zodValidationRequest(ServiceValidation.updateValidationSchema),
  ServiceController.updateAIntoDB,
)

router.get('/active', auth(USER_ROLE.user), ServiceController.getActiveServices)

router.get(
  '/author/my-services',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  ServiceController.getMyServices,
)

router.get(
  '/featured/:userId',
  auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  ServiceController.getUserFeatures,
)

router.get(
  '/recommend',
  auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  ServiceController.getAllRecommendServices,
)

router.get(
  '/user/:userId',
  auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  ServiceController.getUserServices,
)
router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  ServiceController.getAIntoDB,
)

router.get('/', auth(USER_ROLE.admin), ServiceController.getAllIntoDB)

router.delete(
  '/:id',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  ServiceController.deleteAIntoDB,
)

export const ServiceRoutes = router
