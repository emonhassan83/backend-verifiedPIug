import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { SearchHistoryService } from './searchHistory.service'

const searchData = catchAsync(async (req, res) => {
  const result = await SearchHistoryService.searchDataIntoDB(req.query)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Search data retrieved successfully!',
    data: result,
  })
})

const getSuggestData = catchAsync(async (req, res) => {
  const result = await SearchHistoryService.getSuggestData(req.user._id)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Search suggest retrieved successfully!',
    data: result,
  })
})

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await SearchHistoryService.insertIntoDB(req.body, req.user._id)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Search histories insert successfully!',
    data: result,
  })
})

const getAllIntoDB = catchAsync(async (req, res) => {
  req.query['userId'] = req.user._id;
  const result = await SearchHistoryService.getAllIntoDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Search histories retrieved successfully!',
    meta: result.meta,
    data: result.data,
  })
})


const deleteAIntoDB = catchAsync(async (req, res) => {
  const result = await SearchHistoryService.deleteAIntoDB(req.params.id)
  
  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Search histories delete successfully!',
    data: result,
  })
})

const clearHistoriesIntoDB = catchAsync(async (req, res) => {
  const result = await SearchHistoryService.clearSearchHistory(
    req.params.userId,
  )

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Search histories clear successfully!',
    data: result,
  })
})

export const SearchHistoryController = {
  searchData,
  getSuggestData,
  insertIntoDB,
  getAllIntoDB,
  deleteAIntoDB,
  clearHistoriesIntoDB,
}
