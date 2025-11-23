import { Router } from 'express'
import { OrderController } from './order.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import zodValidationRequest from '../../middleware/validateRequest'
import { OrderValidation } from './order.validation'

const router = Router()

router.post(
  '/',
  auth(USER_ROLE.planer, USER_ROLE.user),
  zodValidationRequest(OrderValidation.createValidationSchema),
  OrderController.insertIntoDB,
)

router.patch(
  '/status/:id',
  auth(USER_ROLE.admin),
  zodValidationRequest(OrderValidation.changeStatusValidationSchema),
  OrderController.changeStatus,
)

router.put(
  '/:id',
  auth(USER_ROLE.planer, USER_ROLE.user),
  zodValidationRequest(OrderValidation.updateValidationSchema),
  OrderController.updateAIntoDB,
)

router.get(
  '/my-orders',
  auth(USER_ROLE.planer, USER_ROLE.user),
  OrderController.getMyOrder,
)
router.get(
  '/receiver-order',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  OrderController.getReceiverOrder,
)

router.get(
  '/:id',
  auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user, USER_ROLE.admin),
  OrderController.getAIntoDB,
)

router.delete(
  '/:id',
  auth(USER_ROLE.planer, USER_ROLE.user),
  OrderController.deleteAIntoDB,
)

export const OrderRoutes = router
