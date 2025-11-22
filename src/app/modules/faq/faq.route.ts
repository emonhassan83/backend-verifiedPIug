import express from 'express'
import zodValidationRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { FaqControllers } from './faq.controller'
import { FaqValidation } from './faq.validation'

const router = express.Router()

router.post(
  '/',
  auth(USER_ROLE.admin),
  zodValidationRequest(FaqValidation.createValidationSchema),
  FaqControllers.createFaq,
)

router.put(
  '/:id',
  auth(USER_ROLE.admin),
  zodValidationRequest(FaqValidation.updateValidationSchema),
  FaqControllers.updateFaq,
)

router.delete('/:id', auth(USER_ROLE.admin), FaqControllers.deleteAFaq)

router.get('/', FaqControllers.getAllFaqs)

router.get('/:id', FaqControllers.getAFaq)

export const FaqRoutes = router
