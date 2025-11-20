import { Request, Response } from 'express'
import catchAsync from '../../utils/catchAsync'
import { BannerService } from './banner.service'
import sendResponse from '../../utils/sendResponse'

const insertIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await BannerService.insertIntoDB(req.files)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Banner created successfully',
    data: result,
  })
})

// Get all Banner
const getAllIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await BannerService.getAllIntoDB(req.query)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Banner retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})


// Delete Banner
const deleteAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await BannerService.deleteAIntoDB(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Banner deleted successfully',
    data: result,
  })
})

export const BannerController = {
  insertIntoDB,
  getAllIntoDB,
  deleteAIntoDB,
}
