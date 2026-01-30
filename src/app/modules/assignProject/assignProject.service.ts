import httpStatus from 'http-status'
import { TAssignProject } from './assignProject.interface'
import AppError from '../../errors/AppError'
import { User } from '../user/user.model'
import { Project } from '../project/project.models'
import { AssignProject } from './assignProject.models'
import QueryBuilder from '../../builder/QueryBuilder'
import { ORDER_AUTHORITY } from '../order/order.constants'
import { Types } from 'mongoose'
import { Order } from '../order/order.models'
import { TVendorAssignmentStatus } from './assignProject.constants'
import { vendorProjectAssignNotify } from './assignProject.utils'

// Create a new Project
const insertIntoDB = async (userId: string, payload: TAssignProject) => {
  const {
    project: projectId,
    vendor: vendorId,
    vendorOrder: vendorOrderId,
  } = payload

  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your profile not found')
  }

  const vendor = await User.findById(vendorId)
  if (!vendor || vendor?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Vendor not found')
  }

  const order = await Order.findOne({
    _id: vendorOrderId,
    authority: ORDER_AUTHORITY.vendor,
    receiver: vendorId,
    isDeleted: false,
  })
  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found')
  }

  const project = await Project.findById(projectId)
  if (!project || project?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Project data not found')
  }

  // assigning the assignedBy field
  payload.assignedBy = new Types.ObjectId(userId)
  payload.agreedAmount = order.finalAmount

  const result = await AssignProject.create(payload)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Project assign failed')
  }

  // sent notify to vendor
  await vendorProjectAssignNotify(
    new Types.ObjectId(vendorId),
    order,
    result.status,
  )

  return result
}

// Get all assign project data
const getAllIntoDB = async (query: Record<string, any>) => {
  const AssignProjectModel = new QueryBuilder(
    AssignProject.find().populate([
      {
        path: 'vendor',
        select: 'name email photoUrl contractNumber ',
      },
      {
        path: 'vendorOrder',
        select: 'title address locationUrl',
      },
    ]),
    query,
  )
    .search([''])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await AssignProjectModel.modelQuery
  const meta = await AssignProjectModel.countTotal()
  return {
    data,
    meta,
  }
}

// Get Project by ID
const getAIntoDB = async (id: string) => {
  const result = await AssignProject.findById(id).populate([
    {
      path: 'vendor',
      select: 'name email photoUrl contractNumber',
    },
    {
      path: 'vendorOrder',
    },
  ])
  if (!result) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Oops! Project assign vendor not found',
    )
  }

  return result
}

// Update assign project
const updateIntoDB = async (id: string, payload: Partial<TAssignProject>) => {
  const project = await AssignProject.findById(id)
  if (!project) {
    throw new AppError(httpStatus.NOT_FOUND, 'Project assign vendor not found!')
  }

  const result = await AssignProject.findByIdAndUpdate(id, payload, {
    new: true,
  })
  if (!result) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Assign vendor record not updated!',
    )
  }

  return result
}

// Update assign project status
const updateStatusIntoDB = async (
  id: string,
  payload: { status: TVendorAssignmentStatus },
) => {
  const { status } = payload

  const project = await AssignProject.findById(id)
  if (!project) {
    throw new AppError(httpStatus.NOT_FOUND, 'Project assign vendor not found!')
  }

  const result = await AssignProject.findByIdAndUpdate(
    id,
    { status },
    {
      new: true,
    },
  )
  if (!result) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Assign vendor record not updated!',
    )
  }

  // sent notify to vendor
  const order = await Order.findById(result.vendorOrder)
  if (order) {
    await vendorProjectAssignNotify(result.vendor, order, status)
  }

  return result
}

// Delete AssignProject
const deleteAIntoDB = async (id: string) => {
  const project = await AssignProject.findById(id)
  if (!project) {
    throw new AppError(httpStatus.NOT_FOUND, 'Project assign vendor not found!')
  }

  const result = await AssignProject.findByIdAndDelete(id)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Assign project deletion failed')
  }

  return result
}

export const AssignProjectService = {
  insertIntoDB,
  getAllIntoDB,
  getAIntoDB,
  updateIntoDB,
  updateStatusIntoDB,
  deleteAIntoDB,
}
