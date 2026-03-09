import httpStatus from 'http-status'
import { TProject } from './project.interface'
import { Project } from './project.models'
import AppError from '../../errors/AppError'
import { User } from '../user/user.model'
import { Order } from '../order/order.models'
import { AssignProject } from '../assignProject/assignProject.models'
import { Task } from '../task/task.models'

// Create a new Project
const insertIntoDB = async (userId: string, payload: TProject) => {
  const { order: orderId } = payload

  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your profile not found')
  }

  const order = await Order.findById(orderId)
  if (!order || order?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order data not found')
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
  const project = await Project.findOne({ order: id })
    .populate([
      {
        path: 'client',
        select: 'name email photoUrl contractNumber address locationUrl',
      },
      { path: 'order' },
    ])
    .lean()

  if (!project || project?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Oops! Project not found')
  }

  // 1. totalVendor: Count of assigned vendors for this project
  const totalVendor = await AssignProject.countDocuments({
    project: project._id,
    status: { $in: ['assigned', 'inProgress', 'completed'] }
  })

  // 2. budgetProgress: Percentage of budget used (expense vs budget)
  const budgetProgress =
    project.budget > 0
      ? Math.min(Math.round((project.expense / project.budget) * 100), 100)
      : 0

  // 3. taskProgress: Percentage of completed tasks
  const totalTasks = await Task.countDocuments({
    project: project._id,
  })

  const completedTasks = await Task.countDocuments({
    project: project._id,
    isCompleted: true,
  })

  const taskProgress =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Return enriched project data
  return {
    ...project,
    totalVendor,
    budgetProgress,
    taskProgress,
  }
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
