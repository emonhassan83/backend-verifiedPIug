import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { MetaService } from './meta.service'

const adminMetaData = catchAsync(async (req, res) => {
  const result = await MetaService.adminMetaData(req.user._id, req.query)

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Admin meta data retrieval successfully!',
    data: result,
  })
})

const planerMetaData = catchAsync(async (req, res) => {
  const result = await MetaService.adminMetaData(req.user._id, req.query)

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Planer meta data retrieval successfully!',
    data: result,
  })
})

const vendorMetaData = catchAsync(async (req, res) => {
  const result = await MetaService.adminMetaData(req.user._id, req.query)

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Vendor meta data retrieval successfully!',
    data: result,
  })
})

export const MetaController = {
  adminMetaData,
  planerMetaData,
  vendorMetaData
}
