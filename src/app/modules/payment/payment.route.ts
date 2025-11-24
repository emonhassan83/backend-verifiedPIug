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

router.get(
  '/cancel/:subscriptionId',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  PaymentControllers.cancelSubscription,
)

router.get(
  '/enable/:subscriptionId',
  auth(USER_ROLE.planer, USER_ROLE.vendor),
  PaymentControllers.enableSubscription,
)

router.post('/webhook', PaymentControllers.handleWebhook)

router.get('/', PaymentControllers.getAllPayments)

router.get(
  '/reference/:referenceId',
  PaymentControllers.getAPaymentByReferenceId,
)

router.get('/:id', PaymentControllers.getAPayment)

router.patch('/refound-payment', PaymentControllers.refundPayment)

export const PaymentRoutes = router
