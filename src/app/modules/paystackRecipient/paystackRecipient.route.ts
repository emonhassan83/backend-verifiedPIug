import express from 'express'
import zodValidationRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { PaystackRecipientController } from './paystackRecipient.controller'
import { PaystackRecipientValidation } from './paystackRecipient.validation'

const router = express.Router()

router.post(
  '/connect',
  auth(USER_ROLE.vendor, USER_ROLE.planer),
  zodValidationRequest(PaystackRecipientValidation.createValidationSchema),
  PaystackRecipientController.connectAccount,
)

router.delete(
  '/:recipientId',
  auth(USER_ROLE.vendor, USER_ROLE.planer),
  PaystackRecipientController.deleteRecipient,
)

router.get(
  '/banks',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  PaystackRecipientController.getBanks,
)

router.get(
  '/my-recipients',
  auth(USER_ROLE.vendor, USER_ROLE.planer),
  PaystackRecipientController.getMyRecipients,
)

router.patch(
  '/set-default/:recipientId',
  auth(USER_ROLE.vendor, USER_ROLE.planer),
  PaystackRecipientController.setDefault,
)

export const PaystackRecipientRoutes = router
