import { Router } from 'express'
import { CategoryController } from './categories.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import zodValidationRequest from '../../middleware/validateRequest'
import { CategoryValidation } from './categories.validation'
import multer, { memoryStorage } from 'multer'
import parseData from '../../middleware/parseData'

const router = Router()
const storage = memoryStorage()
const upload = multer({ storage })

router.post(
  '/',
  auth(USER_ROLE.admin),
  upload.single('image'),
  parseData(),
  zodValidationRequest(CategoryValidation.createValidationSchema),
  CategoryController.insertIntoDB,
)

router.put(
  '/',
  auth(USER_ROLE.admin),
  upload.single('image'),
  parseData(),
  zodValidationRequest(CategoryValidation.updateValidationSchema),
  CategoryController.updateAIntoDB,
)

router.patch(
  '/toggle-trading/:id',
  auth(USER_ROLE.admin),
  CategoryController.toggleTradingCategory,
)

router.get('/:id', CategoryController.getAIntoDB)

router.get('/', CategoryController.getAllIntoDB)

router.delete('/:id', auth(USER_ROLE.admin), CategoryController.deleteAIntoDB)

export const CategoryRoutes = router
