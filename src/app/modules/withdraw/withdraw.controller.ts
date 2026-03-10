import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { WithdrawService } from './withdraw.service'

const createWithdraw = catchAsync(async (req, res) => {
  const result = await WithdrawService.createWithdrawIntoDB(req.body)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Withdraw create successfully!',
    data: result,
  })
})

const getAllWithdraw = catchAsync(async (req, res) => {
  const result = await WithdrawService.getAllWithdrawsFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Withdraw retrieved successfully!',
    meta: result.meta,
    data: result.data,
  })
})

const getAllMyWithdraw = catchAsync(async (req, res) => {
  req.query['user'] = req.user._id
  const result = await WithdrawService.getAllWithdrawsFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'My Withdraw retrieved successfully!',
    meta: result.meta,
    data: result.data.withdrawList,
  })
})

const getAWithdraw = catchAsync(async (req, res) => {
  const result = await WithdrawService.getAWithdrawFromDB(req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Withdraw retrieved successfully!',
    data: result,
  })
})

const updateWithdraw = catchAsync(async (req, res) => {
  const result = await WithdrawService.updateWithdrawFromDB(
    req.params.id,
    req.body
  )

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Withdraw update successfully!',
    data: result,
  })
})

export const WithdrawControllers = {
  createWithdraw,
  getAllWithdraw,
  getAllMyWithdraw,
  getAWithdraw,
  updateWithdraw
}
