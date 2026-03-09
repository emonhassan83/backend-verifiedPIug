import { Request, Response } from 'express'
import catchAsync from '../../utils/catchAsync'
import { AssignProjectService } from './assignProject.service'
import sendResponse from '../../utils/sendResponse'

const insertIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await AssignProjectService.insertIntoDB(req.user._id, req.body)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Assign vendor in project successfully',
    data: result,
  })
})

const getAllIntoDB = catchAsync(async (req: Request, res: Response) => {
  req.query['project'] = req.params.projectId
  const result = await AssignProjectService.getAllIntoDB(req.query)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Project vendors retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

// Make a payment to a vendor for a project
const makeAVendorPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await AssignProjectService.makeAVendorPayment(req.params.assignProjectId, req.user._id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Project vendor payment made successfully',
    data: result,
  })
})

const compareQuotes = catchAsync(async (req: Request, res: Response) => {
  const result = await AssignProjectService.compareQuotes(req.params.projectId, req.query, req.user._id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Project vendor quotes compared successfully',
    meta: result.meta,
    data: result.data,
  })
})

const updateStatusIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await AssignProjectService.updateStatusIntoDB(req.params.id, req.body)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Project vendor updated successfully',
    data: result,
  })
})

const deleteAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await AssignProjectService.deleteAIntoDB(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Removed vendor successfully',
    data: result,
  })
})

export const AssignProjectController = {
  insertIntoDB,
  getAllIntoDB,
  makeAVendorPayment,
  compareQuotes,
  updateStatusIntoDB,
  deleteAIntoDB
}
