import { Router } from 'express'
import { SearchHistoryController } from './searchHistory.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import zodValidationRequest from '../../middleware/validateRequest'
import { SearchHistoryValidation } from './searchHistory.validation'

const router = Router()

router.post(
  '/',
  auth(USER_ROLE.user, USER_ROLE.vendor, USER_ROLE.planer),
  zodValidationRequest(SearchHistoryValidation.createValidationSchema),
  SearchHistoryController.insertIntoDB,
)

router.get(
  '/',
  auth(USER_ROLE.user, USER_ROLE.vendor, USER_ROLE.planer),
  SearchHistoryController.getAllIntoDB,
)

router.delete(
  '/clear-histories',
  auth(USER_ROLE.user, USER_ROLE.vendor, USER_ROLE.planer),
  SearchHistoryController.clearHistories,
)

router.delete(
  '/:id',
  auth(USER_ROLE.user, USER_ROLE.vendor, USER_ROLE.planer),
  SearchHistoryController.deleteAIntoDB,
)

export const SearchHistoryRoutes = router
