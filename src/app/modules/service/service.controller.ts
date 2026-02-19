import { Request, Response } from 'express'
import catchAsync from '../../utils/catchAsync'
import { ServiceService } from './service.service'
import sendResponse from '../../utils/sendResponse'
import { SERVICE_STATUS } from './service.constants'

const insertIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceService.insertIntoDB(
    req.user._id,
    req.body,
    req.files,
  )

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Service created successfully',
    data: result,
  })
})

// Get all Service
const getAllIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceService.getAllIntoDB(req.query, req.user._id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Services retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

const getAllRecommendServices = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ServiceService.getAllRecommendServices(req.query, req.user._id)

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Recommend Services retrieved successfully',
      meta: result.meta,
      data: result.data,
    })
  },
)

const getActiveServices = catchAsync(async (req: Request, res: Response) => {
  req.query['status'] = SERVICE_STATUS.active
  const result = await ServiceService.getAllIntoDB(req.query, req.user._id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Active services retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

const getMyServices = catchAsync(async (req: Request, res: Response) => {
  req.query['author'] = req.user._id
  req.query['status'] = SERVICE_STATUS.active
  const result = await ServiceService.getAllIntoDB(req.query, req.user._id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'My services retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

const getUserServices = catchAsync(async (req: Request, res: Response) => {
  req.query['author'] = req.params.userId
  req.query['status'] = SERVICE_STATUS.active
  const result = await ServiceService.getAllIntoDB(req.query, req.user._id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'User services retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

const getUserFeatures = catchAsync(async (req: Request, res: Response) => {
  req.query.isFeatured = 'true';
  req.query['author'] = req.params.userId
  const result = await ServiceService.getAllIntoDB(req.query, req.user._id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'User featured services retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

// Get Service by ID
const getAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceService.getAIntoDB(req.params.id, req.user._id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Service retrieved successfully',
    data: result,
  })
})

// Update Service
const updateAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceService.updateAIntoDB(
    req.params.id,
    req.body,
    req.files,
  )

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Service updated successfully',
    data: result,
  })
})

const changeStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceService.changeStatusFromDB(
    req.params.id,
    req.body,
  )

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Service status updated successfully',
    data: result,
  })
})

const changeFeaturedService = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceService.changeFeaturedService(
    req.params.id,
    req.user._id
  )

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: result,
  })
})

// Delete Service
const deleteAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceService.deleteAIntoDB(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Service deleted successfully',
    data: result,
  })
})

export const ServiceController = {
  insertIntoDB,
  getAllIntoDB,
  getActiveServices,
  getAllRecommendServices,
  getMyServices,
  getUserFeatures,
  getUserServices,
  getAIntoDB,
  updateAIntoDB,
  changeStatus,
  changeFeaturedService,
  deleteAIntoDB,
}
