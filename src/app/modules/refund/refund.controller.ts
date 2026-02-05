import catchAsync from '../../utils/catchAsync'
import sendResponse from '../../utils/sendResponse'
import { RefundServices } from './refund.service'

const getAllRefunds = catchAsync(async (req, res) => {
  const result = await RefundServices.getAllRefundsFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Sender refund requests retrieved successfully!',
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
  getAllRefunds,
  getARefund,
  changeRefundStatus,
  deleteARefund,
}
