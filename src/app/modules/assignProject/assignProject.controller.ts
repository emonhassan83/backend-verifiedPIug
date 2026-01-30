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

// Get Project by ID
const getAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await AssignProjectService.getAIntoDB(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Project vendor retrieved successfully',
    data: result,
  })
})

const updateIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await AssignProjectService.updateIntoDB(req.params.id, req.body)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Project vendor updated successfully',
    data: result,
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
  getAIntoDB,
  updateIntoDB,
  updateStatusIntoDB,
  deleteAIntoDB
}
