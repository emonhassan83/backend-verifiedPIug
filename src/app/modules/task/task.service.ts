import httpStatus from 'http-status'
import { TTask } from './task.interface'
import AppError from '../../errors/AppError'
import { User } from '../user/user.model'
import { Project } from '../project/project.models'
import { Task } from './task.models'
import QueryBuilder from '../../builder/QueryBuilder'

// Create a new Project
const insertIntoDB = async (userId: string, payload: TTask) => {
  const { project: projectId } = payload

  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your profile not found')
  }

  const project = await Project.findById(projectId)
  if (!project || project?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Project data not found')
  }

  const result = await Task.create(payload)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Task creation failed')
  }

  return result
}

// Get all assign project data
const getAllIntoDB = async (query: Record<string, any>) => {
  const TaskModel = new QueryBuilder(Task.find(), query)
    .search([''])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await TaskModel.modelQuery
  const meta = await TaskModel.countTotal()
  return {
    data,
    meta,
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
  const task = await Task.findById(id);

  if (!task) {
    throw new AppError(httpStatus.NOT_FOUND, "Task not found!");
  }

  const updatedStatus = !task.isCompleted;

  const result = await Task.findByIdAndUpdate(
    id,
    { isCompleted: updatedStatus },
    { new: true }
  );

  if (!result) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Task record not updated!"
    );
  }

  return result;
};

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
