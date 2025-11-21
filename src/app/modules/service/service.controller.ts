import { Request, Response } from 'express'
import catchAsync from '../../utils/catchAsync'
import { CategoryService } from './service.service'
import sendResponse from '../../utils/sendResponse'

const insertIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await CategoryService.insertIntoDB(req.body, req.file)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Category created successfully',
    data: result,
  })
})

// Get all Category
const getAllIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await CategoryService.getAllIntoDB(req.query)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Categories retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

// Get Category by ID
const getAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await CategoryService.getAIntoDB(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Category retrieved successfully',
    data: result,
  })
})

// Update Category
const updateAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await CategoryService.updateAIntoDB(req.params.id, req.body, req.file)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Category updated successfully',
    data: result,
  })
})


// Delete Category
const deleteAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await CategoryService.deleteAIntoDB(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Category deleted successfully',
    data: result,
  })
})

export const CategoryController = {
  insertIntoDB,
  getAllIntoDB,
  getAIntoDB,
  updateAIntoDB,
  deleteAIntoDB,
}
