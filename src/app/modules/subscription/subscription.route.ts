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
  '/status/:id',
  auth(USER_ROLE.admin),
  subscriptionController.updateSubscription,
)

router.patch(
  '/cancel/:subscriptionId',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  subscriptionController.cancelSubscription,
)

router.patch(
  '/enable/:subscriptionId',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  subscriptionController.enableSubscription,
)

router.get(
  '/my-subscription',
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
