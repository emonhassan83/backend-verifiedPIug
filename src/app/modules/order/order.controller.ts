import { Request, Response } from 'express'
import catchAsync from '../../utils/catchAsync'
import { OrderService } from './order.service'
import sendResponse from '../../utils/sendResponse'
import { ORDER_AUTHORITY } from './order.constants'

const insertIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.insertIntoDB(req.user._id, req.body)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Order created successfully',
    data: result,
  })
})

// Get client orders
const allClientOrders = catchAsync(async (req: Request, res: Response) => {
  req.query['authority'] = ORDER_AUTHORITY.client
  const result = await OrderService.getAllIntoDB(req.query)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'All client orders retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

const myClientOrders = catchAsync(async (req: Request, res: Response) => {
  req.query['authority'] = ORDER_AUTHORITY.client
  // Preserve searchTerm
  const searchTerm = req.query.searchTerm
  delete req.query.searchTerm // Prevent filter overwrite

  const result = await OrderService.getMyIntoDB(req.query, req.user._id)

  // Manual client-side filtering (fallback)
  let filteredData = result.data

  if (searchTerm) {
    const regex = new RegExp(searchTerm as string, 'i')
    filteredData = filteredData.filter((order: any) => regex.test(order.title))
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Client orders retrieved successfully',
    meta: {
      ...result.meta,
      total: filteredData.length,
      totalPage: Math.ceil(
        filteredData.length / (Number(req.query.limit) || 10),
      ),
    },
    data: filteredData,
  })
})

// Get vendor orders
const allVendorOrders = catchAsync(async (req: Request, res: Response) => {
  req.query['authority'] = ORDER_AUTHORITY.vendor
  const result = await OrderService.getAllIntoDB(req.query)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'All vendor orders retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

const myVendorOrders = catchAsync(async (req: Request, res: Response) => {
  req.query.authority = ORDER_AUTHORITY.vendor

  // Preserve searchTerm
  const searchTerm = req.query.searchTerm
  delete req.query.searchTerm // Prevent filter overwrite

  const result = await OrderService.getMyIntoDB(req.query, req.user._id)

  // Manual client-side filtering (fallback)
  let filteredData = result.data

  if (searchTerm) {
    const regex = new RegExp(searchTerm as string, 'i')
    filteredData = filteredData.filter((order: any) => regex.test(order.title))
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Vendor orders retrieved successfully',
    meta: {
      ...result.meta,
      total: filteredData.length,
      totalPage: Math.ceil(
        filteredData.length / (Number(req.query.limit) || 10),
      ),
    },
    data: filteredData,
  })
})

const myVendorOrdersByVendor = catchAsync(async (req: Request, res: Response) => {
  req.query.authority = ORDER_AUTHORITY.vendor
  req.query.receiver = req.user._id

  // Preserve searchTerm
  const searchTerm = req.query.searchTerm
  delete req.query.searchTerm // Prevent filter overwrite

  const result = await OrderService.getVendorOrders(req.query, req.params.vendorId)

  // Manual client-side filtering (fallback)
  let filteredData = result.data

  if (searchTerm) {
    const regex = new RegExp(searchTerm as string, 'i')
    filteredData = filteredData.filter((order: any) => regex.test(order.title))
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Vendor orders by vendorID retrieved successfully',
    meta: {
      ...result.meta,
      total: filteredData.length,
      totalPage: Math.ceil(
        filteredData.length / (Number(req.query.limit) || 10),
      ),
    },
    data: filteredData,
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
  const result = await OrderService.updateAIntoDB(req.params.id, req.body)

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
    req.user._id,
  )

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Order status updated successfully',
    data: result,
  })
})

const cancelOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.cancelOrderFromDB(
    req.params.id,
    req.body,
    req.user._id,
  )

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Order canceled successfully!',
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
  myVendorOrders,
  allClientOrders,
  allVendorOrders,
  myVendorOrdersByVendor,
  myClientOrders,
  getAIntoDB,
  updateAIntoDB,
  changeStatus,
  cancelOrder,
  deleteAIntoDB,
}
