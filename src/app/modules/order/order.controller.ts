import { Request, Response } from 'express'
import catchAsync from '../../utils/catchAsync'
import { OrderService } from './order.service'
import sendResponse from '../../utils/sendResponse'

const insertIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.insertIntoDB(req.user._id, req.body)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Order created successfully',
    data: result,
  })
})

// Get all Service
const mySendOrders = catchAsync(async (req: Request, res: Response) => {
  req.query['sender'] = req.user._id
  const result = await OrderService.getAllIntoDB(req.query)
  
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'My send orders retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

const myReceiveOrders = catchAsync(async (req: Request, res: Response) => {
  req.query['receiver'] = req.user._id
  const result = await OrderService.getAllIntoDB(req.query)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'My receive orders retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

// Get Order by ID
const getAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.getAIntoDB(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Order retrieved successfully',
    data: result,
  })
})

// Update Service
const updateAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.updateAIntoDB(
    req.params.id,
    req.body
  )

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Order updated successfully',
    data: result,
  })
})

const changeStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.changeStatusFromDB(
    req.params.id,
    req.body,
    req.user._id
  )

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Order status updated successfully',
    data: result,
  })
})

// Delete Service
const deleteAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.deleteAIntoDB(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Order deleted successfully',
    data: result,
  })
})

export const OrderController = {
  insertIntoDB,
  myReceiveOrders,
  mySendOrders,
  getAIntoDB,
  updateAIntoDB,
  changeStatus,
  deleteAIntoDB,
}
