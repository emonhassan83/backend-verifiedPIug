import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { AnalysisService } from './analysis.service'

const adminAnalysisData = catchAsync(async (req, res) => {
  const result = await AnalysisService.adminAnalysisData(req.user._id, req.query)

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Admin analysis data retrieval successfully!',
    data: result,
  })
})

const planerAnalysisRevenue = catchAsync(async (req, res) => {
  const result = await AnalysisService.planerAnalysisRevenue(req.user._id, req.query)

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Planer analysis data retrieval successfully!',
    data: result,
  })
})

const vendorAnalysisData = catchAsync(async (req, res) => {
  const result = await AnalysisService.vendorAnalysisData(req.user._id)

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Vendor analysis data retrieval successfully!',
    data: result,
  })
})

export const AnalysisController = {
  adminAnalysisData,
  planerAnalysisRevenue,
  vendorAnalysisData
}
