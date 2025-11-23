import { Router } from 'express'
import { reviewsController } from './review.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import zodValidationRequest from '../../middleware/validateRequest'
import { ReviewsValidation } from './review.validation'

const router = Router()

router.post(
  '/',
 auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  zodValidationRequest(ReviewsValidation.createValidationSchema),
  reviewsController.createReviews,
)

router.put(
  '/:id',
 auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  zodValidationRequest(ReviewsValidation.updateValidationSchema),
  reviewsController.updateReviews,
)

router.delete(
  '/:id',
 auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  reviewsController.deleteReviews,
)

router.get(
  '/service/:serviceId',
  auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  reviewsController.getReviewsByService,
)

router.get(
  '/user/:userId',
 auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  reviewsController.getUserReviews,
)

router.get(
  '/:id',
 auth(USER_ROLE.planer, USER_ROLE.vendor, USER_ROLE.user),
  reviewsController.getReviewsById,
)


export const ReviewsRoutes = router
