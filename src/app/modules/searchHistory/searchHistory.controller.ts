import { Request, Response } from 'express'
import catchAsync from '../../utils/catchAsync'
import { SearchHistoryService } from './searchHistory.service'
import sendResponse from '../../utils/sendResponse'

const insertIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await SearchHistoryService.insertIntoDB(req.user._id, req.body)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Search history created successfully',
    data: result,
  })
})

// Get all SearchHistory
const getAllIntoDB = catchAsync(async (req: Request, res: Response) => {
  req.query['user'] = req.user._id
  const result = await SearchHistoryService.getAllIntoDB(req.query)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Search histories retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

const clearHistories = catchAsync(async (req: Request, res: Response) => {
  const result = await SearchHistoryService.clearSearchHistory(req.user._id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Search history clear successfully',
    data: result,
  })
})

// Delete SearchHistory
const deleteAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await SearchHistoryService.deleteAIntoDB(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'SearchHistory deleted successfully',
    data: result,
  })
})

export const SearchHistoryController = {
  insertIntoDB,
  getAllIntoDB,
  deleteAIntoDB,
  clearHistories
}
