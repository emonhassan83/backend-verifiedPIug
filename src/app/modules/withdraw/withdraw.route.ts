import express from 'express'
import zodValidationRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { WithdrawControllers } from './withdraw.controller'
import { WithdrawValidation } from './withdraw.validation'

const router = express.Router()

router.post(
  '/',
  auth(USER_ROLE.vendor, USER_ROLE.planer),
  zodValidationRequest(WithdrawValidation.createValidationSchema),
  WithdrawControllers.createWithdraw,
)

router.patch(
  '/status/:id',
  auth(USER_ROLE.admin),
  WithdrawControllers.updateWithdraw,
)

router.get(
  '/my-withdraw',
  auth(USER_ROLE.vendor, USER_ROLE.planer),
  WithdrawControllers.getAllMyWithdraw,
)

router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.vendor, USER_ROLE.planer),
  WithdrawControllers.getAWithdraw,
)

router.get(
  '/',
  auth(USER_ROLE.admin),
  WithdrawControllers.getAllWithdraw,
)

export const WithdrawRoutes = router
