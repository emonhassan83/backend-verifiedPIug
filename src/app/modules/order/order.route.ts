import { Router } from 'express'
import { OrderController } from './order.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import zodValidationRequest from '../../middleware/validateRequest'
import { OrderValidation } from './order.validation'

const router = Router()

router.post(
  '/',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  zodValidationRequest(OrderValidation.createValidationSchema),
  OrderController.insertIntoDB,
)

router.patch(
  '/canceled/:id',
  auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  zodValidationRequest(OrderValidation.cancelOrderValidationSchema),
  OrderController.cancelOrder,
)

router.patch(
  '/status/:id',
  auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
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
  '/author/my-client-orders',
  auth(USER_ROLE.planer, USER_ROLE.user),
  OrderController.myClientOrders,
)

router.get(
  '/client-orders',
  auth(USER_ROLE.admin),
  OrderController.allClientOrders,
)

router.get(
  '/author/my-vendor-orders',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  OrderController.myVendorOrders,
)

router.get(
  '/author/vendor-orders/:vendorId',
  auth(USER_ROLE.planer),
  OrderController.myVendorOrdersByVendor,
)

router.get(
  '/vendor-orders',
  auth(USER_ROLE.admin),
  OrderController.allVendorOrders,
)

router.get(
  '/:id',
  auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user, USER_ROLE.admin),
  OrderController.getAIntoDB,
)

router.delete(
  '/:id',
  auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  OrderController.deleteAIntoDB,
)

export const OrderRoutes = router
