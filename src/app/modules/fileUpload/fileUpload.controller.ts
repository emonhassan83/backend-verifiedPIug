import { Request, Response } from 'express'
import catchAsync from '../../utils/catchAsync'
import { FileService } from './fileUpload.service'
import sendResponse from '../../utils/sendResponse'

const insertIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await FileService.insertIntoDB(req.user._id, req.body, req.files)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'File upload successfully',
    data: result,
  })
})

// Get all File
const getAllIntoDB = catchAsync(async (req: Request, res: Response) => {
  req.query['project'] = req.params.projectId
  const result = await FileService.getAllIntoDB(req.query)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Files retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

// Delete File
const deleteAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await FileService.deleteAIntoDB(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'File deleted successfully',
    data: result,
  })
})

export const FileController = {
  insertIntoDB,
  getAllIntoDB,
  deleteAIntoDB,
}
