import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { RefundServices } from './refund.service'

const createRefund = catchAsync(async (req, res) => {
  const result = await RefundServices.createRefundIntoDB(req.body, req.user._id)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Refund request added successfully!',
    data: result,
  })
})

const getSenderRefunds = catchAsync(async (req, res) => {
  req.query['sender'] = req.user._id
  const result = await RefundServices.getAllRefundsFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Sender refund requests retrieved successfully!',
    meta: result.meta,
    data: result.result,
  })
})

const getReceiverRefunds = catchAsync(async (req, res) => {
  req.query['receiver'] = req.user._id
  const result = await RefundServices.getAllRefundsFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Receiver refund requests retrieved successfully!',
    meta: result.meta,
    data: result.result,
  })
})

const getARefund = catchAsync(async (req, res) => {
  const result = await RefundServices.getARefundFromDB(req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Refund request retrieved successfully!',
    data: result,
  })
})

const changeRefundStatus = catchAsync(async (req, res) => {
  const result = await RefundServices.updateRefundStatusFromDB(
    req.params.id,
    req.body,
  )

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Refund request status updated successfully!',
    data: result,
  })
})

const deleteARefund = catchAsync(async (req, res) => {
  const result = await RefundServices.deleteARefundFromDB(req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Refund request deleted successfully!',
    data: result,
  })
})

export const RefundControllers = {
  createRefund,
  getSenderRefunds,
  getReceiverRefunds,
  getARefund,
  changeRefundStatus,
  deleteARefund,
}
