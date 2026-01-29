import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { PaymentService } from './payment.service'

const checkout = catchAsync(async (req, res) => {
  const result = await PaymentService.checkout(req.body)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'payment link get successful',
    data: result,
  })
})

const confirmPayment = catchAsync(async (req, res) => {
  const result = await PaymentService.confirmPayment(req?.query)

  // res.redirect(
  //   `${config.payment_success_url}?subscriptionId=${result?.reference}`,
  // )

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: result?.modelType === 'Subscription' ? 'Subscription confirmed successfully' : 'Payment confirmed successfully',
    data: result,
  })
})

const handleWebhook = catchAsync(async (req, res) => {
  const result = await PaymentService.handleWebhook(req);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Webhook processed successfully',
    data: result,
  });
});

const getAllPayments = catchAsync(async (req, res) => {
  const result = await PaymentService.getAllPaymentsFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Payments retrieved successfully!',
    meta: result.meta,
    data: result.data,
  })
})

const getAPaymentByReferenceId = catchAsync(async (req, res) => {
  const result = await PaymentService.getAPaymentByReferenceIdFromDB(req.params.referenceId)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Payment retrieved successfully!',
    data: result,
  })
})

const getDashboardData = catchAsync(async (req, res) => {
  const result = await PaymentService.getDashboardDataFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Payments retrieved successfully!',
    data: result,
  })
})

const getAPayment = catchAsync(async (req, res) => {
  const result = await PaymentService.getAPaymentsFromDB(req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Payment retrieved successfully!',
    data: result,
  })
})

const refundPayment = catchAsync(async (req, res) => {
  const result = await PaymentService.refundPayment(req.body)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Payment refund successfully!',
    data: result,
  })
})

export const PaymentControllers = {
  checkout,
  confirmPayment,
  handleWebhook,
  getAllPayments,
  getDashboardData,
  getAPayment,
  getAPaymentByReferenceId,
  refundPayment,
}
