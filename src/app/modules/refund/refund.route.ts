import express from 'express'
import zodValidationRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { RefundControllers } from './refund.controller'
import { RefundValidation } from './refund.validation'

const router = express.Router()

router.post(
  '/',
  auth(USER_ROLE.user, USER_ROLE.planer),
  zodValidationRequest(RefundValidation.createValidationSchema),
  RefundControllers.createRefund,
)

router.patch(
  '/:id',
  auth(USER_ROLE.vendor, USER_ROLE.planer),
  RefundControllers.changeRefundStatus,
)

router.delete('/:id', auth(USER_ROLE.user, USER_ROLE.planer), RefundControllers.deleteARefund)

router.get(
  '/sender-refunds',
  auth(USER_ROLE.user, USER_ROLE.planer),
  RefundControllers.getSenderRefunds,
)

router.get(
  '/receiver-refunds',
  auth(USER_ROLE.vendor, USER_ROLE.planer),
  RefundControllers.getReceiverRefunds,
)

router.get(
  '/:id',
  auth(
    USER_ROLE.planer,
    USER_ROLE.vendor,
    USER_ROLE.user,
  ),
  RefundControllers.getARefund,
)

export const RefundRoutes = router
