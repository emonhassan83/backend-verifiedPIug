import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { FavoriteService } from './favorite.service'

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await FavoriteService.insertIntoDB(
    req.user._id,
    req.params.serviceId,
  )

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: result.data,
  })
})

const getAllIntoDB = catchAsync(async (req, res) => {
  req.query['user'] = req.user._id
  const result = await FavoriteService.getAllIntoDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Favorites retrieved successfully!',
    meta: result.meta,
    data: result.result,
  })
})

const getAIntoDB = catchAsync(async (req, res) => {
  const result = await FavoriteService.getAIntoDB(req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Favorite retrieved successfully!',
    data: result,
  })
})

const deleteAIntoDB = catchAsync(async (req, res) => {
  const result = await FavoriteService.deleteAIntoDB(req.params.id, req.user._id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Favorite removed successfully!',
    data: result,
  })
})

export const FavoriteControllers = {
  insertIntoDB,
  getAllIntoDB,
  getAIntoDB,
  deleteAIntoDB
}
