import express from 'express'
import zodValidationRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { PaymentValidation } from './payment.validation'
import { PaymentControllers } from './payment.controller'

const router = express.Router()

router.post(
  '/checkout',
  zodValidationRequest(PaymentValidation.createValidationSchema),
  PaymentControllers.checkout,
)

router.get('/confirm-payment', PaymentControllers.confirmPayment)

router.post('/webhook', PaymentControllers.handleWebhook)

router.get('/', auth(USER_ROLE.admin), PaymentControllers.getAllPayments)

router.get(
  '/reference/:referenceId',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  PaymentControllers.getAPaymentByReferenceId,
)

router.get('/:id', auth(USER_ROLE.admin), PaymentControllers.getAPayment)

router.patch(
  '/refound-payment',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  PaymentControllers.refundPayment,
)

export const PaymentRoutes = router
