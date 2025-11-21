import { Request, Response } from 'express'
import catchAsync from '../../utils/catchAsync'
import { PortfolioService } from './portfolio.service'
import sendResponse from '../../utils/sendResponse'

const insertIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await PortfolioService.insertIntoDB(req.user._id,req.files)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Portfolio created successfully',
    data: result,
  })
})

// Get all Portfolio
const getAllIntoDB = catchAsync(async (req: Request, res: Response) => {
  req.query['author'] = req.user._id
  const result = await PortfolioService.getAllIntoDB(req.query)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'My portfolio retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

// Get User  Portfolio
const getUsersPortfolio = catchAsync(async (req: Request, res: Response) => {
  req.query['author'] = req.params.userId
  const result = await PortfolioService.getAllIntoDB(req.query)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'My portfolio retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})


// Delete Portfolio
const deleteAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await PortfolioService.deleteAIntoDB(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Portfolio deleted successfully',
    data: result,
  })
})

export const PortfolioController = {
  insertIntoDB,
  getAllIntoDB,
  getUsersPortfolio,
  deleteAIntoDB,
}
