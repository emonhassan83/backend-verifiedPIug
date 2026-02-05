import express from 'express'
import zodValidationRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { RefundControllers } from './refund.controller'
import { RefundValidation } from './refund.validation'

const router = express.Router()

router.patch(
  '/status/:id',
  auth(USER_ROLE.admin),
  zodValidationRequest(RefundValidation.updateValidationSchema),
  RefundControllers.changeRefundStatus,
)

router.delete('/:id', auth(USER_ROLE.admin), RefundControllers.deleteARefund)

router.get('/', auth(USER_ROLE.admin), RefundControllers.getAllRefunds)

router.get('/:id', auth(USER_ROLE.admin), RefundControllers.getARefund)

export const RefundRoutes = router
