import httpStatus from 'http-status'
import { TTask } from './task.interface'
import AppError from '../../errors/AppError'
import { User } from '../user/user.model'
import { Project } from '../project/project.models'
import { Task } from './task.models'
import QueryBuilder from '../../builder/QueryBuilder'
import { USER_ROLE, USER_STATUS } from '../user/user.constant'
import { checkSubscriptionPermission } from '../../utils/subscription.utils'

// Create a new task record
const insertIntoDB = async (userId: string, payload: TTask) => {
  const { project: projectId } = payload

  // 1. Validate planner
  const user = await User.findOne({
    _id: userId,
    role: USER_ROLE.planer,
    status: USER_STATUS.active,
    isDeleted: false,
  })
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your profile not found')
  }

  // 2. Subscription check: Only Elite can create tasks
  const { level } = await checkSubscriptionPermission(userId, 'teamAccess')
  if (level !== 'elite') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Task creation is only available in the Elite (Planner Pro / Agency) plan. ' +
        'Please upgrade your subscription',
    )
  }

  // 3. Validate project
  const project = await Project.findById(projectId)
  if (!project || project?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Project data not found')
  }

  // 4. Create task
  const result = await Task.create(payload)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Task creation failed')
  }

  return result
}

// Get all task data
const getAllIntoDB = async (query: Record<string, any>, userId: string) => {
  const user = await User.findOne({
    _id: userId,
    role: USER_ROLE.planer,
    status: USER_STATUS.active,
    isDeleted: false,
  })
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your profile not found')
  }

  // Subscription check: Only Elite can create tasks
  const { level } = await checkSubscriptionPermission(userId, 'teamAccess')
  if (level !== 'elite') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Task creation is only available in the Elite (Planner Pro / Agency) plan. ' +
        'Please upgrade your subscription',
    )
  }

  const taskModel = new QueryBuilder(Task.find(), query)
    .search([''])
    .filter()
    .paginate()
    .sort()
    .fields()

  const taskList = await taskModel.modelQuery

  // Calculate statistics
  const totalTasks = taskList.length
  const completedTask = taskList.filter((task) => task.isCompleted).length
  const incompleteTask = totalTasks - completedTask
  const progress =
    totalTasks > 0 ? Math.round((completedTask / totalTasks) * 100) : 0

  // Get meta data
  const meta = await taskModel.countTotal()

  return {
    meta,
    data: {
      incompleteTask,
      completedTask,
      progress,
      taskList,
    },
  }
}

// Get Project by ID
const getAIntoDB = async (id: string) => {
  const result = await Task.findById(id)
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Oops! Task not found!')
  }

  return result
}

// Update assign project
const updateIntoDB = async (id: string, payload: Partial<TTask>) => {
  const task = await Task.findById(id)
  if (!task) {
    throw new AppError(httpStatus.NOT_FOUND, 'Task not found!')
  }

  const result = await Task.findByIdAndUpdate(id, payload, {
    new: true,
  })
  if (!result) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Task record not updated!',
    )
  }

  return result
}

// Toggle task status
const changedStatusIntoDB = async (id: string) => {
  const task = await Task.findById(id)
  if (!task) {
    throw new AppError(httpStatus.NOT_FOUND, 'Task not found!')
  }

  const updatedStatus = !task.isCompleted

  const result = await Task.findByIdAndUpdate(
    id,
    { isCompleted: updatedStatus },
    { new: true },
  )

  if (!result) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Task record not updated!',
    )
  }

  return result
}

// Delete Task
const deleteAIntoDB = async (id: string) => {
  const task = await Task.findById(id)
  if (!task) {
    throw new AppError(httpStatus.NOT_FOUND, 'Task not found!')
  }

  const result = await Task.findByIdAndDelete(id)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Task deletion failed')
  }

  return result
}

export const TaskService = {
  insertIntoDB,
  getAllIntoDB,
  getAIntoDB,
  updateIntoDB,
  changedStatusIntoDB,
  deleteAIntoDB,
}
