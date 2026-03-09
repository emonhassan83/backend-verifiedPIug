import { Request, Response } from 'express'
import catchAsync from '../../utils/catchAsync'
import { ProjectService } from './project.service'
import sendResponse from '../../utils/sendResponse'

const projectPaymentOverview = catchAsync(async (req: Request, res: Response) => {
  const result = await ProjectService.projectPaymentOverview(req.params.projectId, req.user._id, req.query)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Project payment overview retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

// Get Project by ID
const getAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await ProjectService.getAIntoDB(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Project retrieved successfully',
    data: result,
  })
})

const changeStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await ProjectService.changeStatusFromDB(req.params.id, req.body)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Project status updated successfully',
    data: result,
  })
})

export const ProjectController = {
  projectPaymentOverview,
  getAIntoDB,
  changeStatus,
}
