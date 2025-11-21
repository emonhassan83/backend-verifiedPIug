import { Request, Response } from 'express'
import catchAsync from '../../utils/catchAsync'
import { VerificationService } from './verification.service'
import sendResponse from '../../utils/sendResponse'

const insertIntoDB = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] }
  const result = await VerificationService.insertIntoDB(req.user._id, req.body, files)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Verification created successfully',
    data: result,
  })
})

// Get all Verification
const getAllIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await VerificationService.getAllIntoDB(req.query)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Verifications retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

// Get Verification by ID
const getAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await VerificationService.getAIntoDB(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Verification retrieved successfully',
    data: result,
  })
})

// Update Verification
const updateAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await VerificationService.updateAIntoDB(
    req.params.id,
    req.body,
  )

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Verification updated successfully',
    data: result,
  })
})

// Delete Verification
const deleteAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await VerificationService.deleteAIntoDB(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Verification deleted successfully',
    data: result,
  })
})

export const VerificationController = {
  insertIntoDB,
  getAllIntoDB,
  getAIntoDB,
  updateAIntoDB,
  deleteAIntoDB,
}
