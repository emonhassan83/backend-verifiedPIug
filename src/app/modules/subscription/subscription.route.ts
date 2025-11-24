import { Router } from 'express'
import { subscriptionController } from './subscription.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import zodValidationRequest from '../../middleware/validateRequest'
import { subscriptionValidation } from './subscription.validation'

const router = Router()

router.post(
  '/',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  zodValidationRequest(subscriptionValidation.createValidationSchema),
  subscriptionController.createSubscription,
)

router.patch(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.planer, USER_ROLE.vendor),
  subscriptionController.updateSubscription,
)

router.delete(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.planer, USER_ROLE.vendor),
  subscriptionController.deleteSubscription,
)

router.get(
  '/my-subscriptions',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  subscriptionController.getMySubscription,
)

router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.planer, USER_ROLE.vendor),
  subscriptionController.getSubscriptionById,
)

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.planer, USER_ROLE.vendor),
  subscriptionController.getAllSubscription,
)

export const SubscriptionRoutes = router
