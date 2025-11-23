import httpStatus from 'http-status'
import { TProject } from './project.interface'
import { Project } from './project.models'
import AppError from '../../errors/AppError'
import { User } from '../user/user.model'
import { Order } from '../order/order.models'

// Create a new Project
const insertIntoDB = async (userId: string, payload: TProject) => {
  const { order: orderId } = payload

  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your profile not found')
  }

  const order = await Order.findById(orderId)
  if (!order || order?.isDeleted) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Order data not found',
    )
  }

  // Assign to payload
  payload.author = user._id

  const result = await Project.create(payload)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Project creation failed')
  }

  return result
}

// Get Project by ID
const getAIntoDB = async (id: string) => {
  const result = await Project.findById(id)
  if (!result || result?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Oops! Project not found')
  }

  return result
}

const changeStatusFromDB = async (id: string, payload: any) => {
  const { status } = payload

  const project = await Project.findById(id)
  if (!project) {
    throw new AppError(httpStatus.NOT_FOUND, 'Project not found!')
  }

  const result = await Project.findByIdAndUpdate(
    project._id,
    { status },
    { new: true },
  )
  if (!result) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Project not found and failed to update status!',
    )
  }

  return result
}

export const ProjectService = {
  insertIntoDB,
  getAIntoDB,
  changeStatusFromDB,
}
