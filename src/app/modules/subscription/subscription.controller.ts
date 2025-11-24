import { Request, Response } from 'express'
import catchAsync from '../../utils/catchAsync'
import { subscriptionService } from './subscription.service'
import sendResponse from '../../utils/sendResponse'

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

const deleteSubscription = catchAsync(async (req: Request, res: Response) => {
  const result = await subscriptionService.deleteSubscription(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Subscription deleted successfully',
    data: result,
  })
})

export const subscriptionController = {
  createSubscription,
  getAllSubscription,
  getSubscriptionById,
  updateSubscription,
  deleteSubscription,
  getMySubscription,
}
