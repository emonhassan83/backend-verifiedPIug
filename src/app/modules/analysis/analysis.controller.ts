import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { AnalysisService } from './analysis.service'

const adminAnalysisData = catchAsync(async (req, res) => {
  const result = await AnalysisService.adminAnalysisData(req.user._id, req.query)

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Admin analysis fetch successfully!',
    data: result,
  })
})

const planerRevenueAnalysis = catchAsync(async (req, res) => {
  const result = await AnalysisService.planerAnalysisRevenue(req.user._id, req.query)

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Planer revenue fetch successfully!',
    data: result,
  })
})

const planerEventAnalysis = catchAsync(async (req, res) => {
  const result = await AnalysisService.planerAnalysisEventType(req.user._id)

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Planer event analysis fetch successfully!',
    data: result,
  })
})

const planerVendorAnalysis = catchAsync(async (req, res) => {
  const result = await AnalysisService.planerAnalysisTopVendor(req.user._id)

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Planer vendor analysis fetch successfully!',
    data: result,
  })
})

const vendorAnalysisData = catchAsync(async (req, res) => {
  const result = await AnalysisService.vendorAnalysisData(req.user._id)

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Vendor analysis fetch successfully!',
    data: result,
  })
})

export const AnalysisController = {
  adminAnalysisData,
  planerRevenueAnalysis,
  planerEventAnalysis,
  planerVendorAnalysis,
  vendorAnalysisData
}
