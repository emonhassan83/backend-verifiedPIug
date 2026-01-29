import { Request, Response } from 'express'
import catchAsync from '../../utils/catchAsync'
import { subscriptionService } from './subscription.service'
import sendResponse from '../../utils/sendResponse'
import httpStatus from 'http-status'

const createSubscription = catchAsync(async (req: Request, res: Response) => {
  req.body.user = req?.user?._id
  const result = await subscriptionService.createSubscription(req.body)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Subscription created successfully !',
    data: result,
  })
})

const getAllSubscription = catchAsync(async (req: Request, res: Response) => {
  const result = await subscriptionService.getAllSubscription(req.query)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'All subscriptions fetched successfully !',
    meta: result?.meta,
    data: result?.data,
  })
})

const getMySubscription = catchAsync(async (req: Request, res: Response) => {
  req.query['user'] = req.user._id;

  const result = await subscriptionService.getAllSubscription(req.query)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'All subscriptions fetched successfully !',
    meta: result?.meta,
    data: result?.data,
  })
})

const getSubscriptionById = catchAsync(async (req: Request, res: Response) => {
  const result = await subscriptionService.getSubscriptionById(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Subscription fetched successfully !',
    data: result,
  })
})

const updateSubscription = catchAsync(async (req: Request, res: Response) => {
  const result = await subscriptionService.updateSubscription(
    req.params.id,
    req.body,
  )

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Subscription updated successfully',
    data: result,
  })
})

const cancelSubscription = catchAsync(async (req, res) => {
  const result = await subscriptionService.cancelSubscription(req.params.subscriptionId, req.user._id)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Auto renew subscription cancel successfully!',
    data: result,
  })
})

const enableSubscription = catchAsync(async (req, res) => {
  const result = await subscriptionService.enableSubscription(req.params.subscriptionId, req.user._id)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Auto renew subscription enable successfully!',
    data: result,
  })
})

export const subscriptionController = {
  createSubscription,
  getAllSubscription,
  getSubscriptionById,
  updateSubscription,
  getMySubscription,
  cancelSubscription,
  enableSubscription,
}
