import { Request, Response } from 'express'
import catchAsync from '../../utils/catchAsync'
import { TaskService } from './task.service'
import sendResponse from '../../utils/sendResponse'

const insertIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await TaskService.insertIntoDB(req.user._id, req.body)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Task insert successfully',
    data: result,
  })
})

const getAllIntoDB = catchAsync(async (req: Request, res: Response) => {
  req.query['project'] = req.params.projectId
  const result = await TaskService.getAllIntoDB(req.query)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Tasks retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

// Get Project by ID
const getAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await TaskService.getAIntoDB(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Task retrieved successfully',
    data: result,
  })
})

const updateIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await TaskService.updateIntoDB(req.params.id, req.body)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Task updated successfully',
    data: result,
  })
})

const changedStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await TaskService.changedStatusIntoDB(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Task status changed successfully',
    data: result,
  })
})

const deleteAIntoDB = catchAsync(async (req: Request, res: Response) => {
  const result = await TaskService.deleteAIntoDB(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Task deleted successfully',
    data: result,
  })
})

export const TaskController = {
  insertIntoDB,
  getAllIntoDB,
  getAIntoDB,
  updateIntoDB,
  changedStatus,
  deleteAIntoDB
}
