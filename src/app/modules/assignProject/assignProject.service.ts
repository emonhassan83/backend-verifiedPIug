import httpStatus from 'http-status'
import { TAssignProject } from './assignProject.interface'
import AppError from '../../errors/AppError'
import { User } from '../user/user.model'
import { Project } from '../project/project.models'
import { AssignProject } from './assignProject.models'
import QueryBuilder from '../../builder/QueryBuilder'
import { ORDER_AUTHORITY, ORDER_STATUS } from '../order/order.constants'
import mongoose, { Types } from 'mongoose'
import { Order } from '../order/order.models'
import { TVendorAssignmentStatus } from './assignProject.constants'
import { vendorProjectAssignNotify } from './assignProject.utils'
import { Chat } from '../chat/chat.models'
import { CHAT_STATUS, CHAT_TYPE } from '../chat/chat.constants'
import { Participant } from '../participant/participant.models'
import {
  PARTICIPANT_ROLE,
  PARTICIPANT_STATUS,
} from '../participant/participant.constants'
import { PROJECT_STATUS } from '../project/project.constants'
import { USER_ROLE, USER_STATUS } from '../user/user.constant'
import { checkSubscriptionPermission } from '../../utils/subscription.utils'

const insertIntoDB = async (userId: string, payload: TAssignProject) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { project: projectId, vendorOrder: vendorOrderId } = payload

    // 1. Requester validation
    const user = await User.findById(userId).session(session)
    if (!user || user.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'Your profile not found')
    }

    // 2. Project validation
    const project = await Project.findById({
      _id: projectId,
      status: PROJECT_STATUS.ongoing,
      isDeleted: false,
    }).session(session)
    if (!project) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Project not found or not eligible for assignment',
      )
    }

    // 3. Vendor Order validation
    const order = await Order.findOne({
      _id: vendorOrderId,
      authority: ORDER_AUTHORITY.vendor,
      status: ORDER_STATUS.running,
      isDeleted: false,
    })
      .populate('sender')
      .session(session)
    if (!order) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Order not found or not eligible for assignment',
      )
    }

    // =============================================
    // NEW CHECK: Prevent duplicate assignment
    // Check if this vendorOrder is already assigned to this project
    // =============================================
    const existingAssignment = await AssignProject.findOne({
      project: projectId,
      vendorOrder: vendorOrderId,
    }).session(session)

    if (existingAssignment) {
      throw new AppError(
        httpStatus.CONFLICT,
        'This vendor order is already assigned to this project. Duplicate assignment is not allowed.',
      )
    }

    // 4. Assign project creation
    payload.vendor = order.sender
    payload.assignedBy = new Types.ObjectId(userId)
    payload.agreedAmount = order.finalAmount

    const assignedProject = await AssignProject.create([payload], { session })
    if (!assignedProject[0]) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Project assign failed')
    }

    // =============================================
    // STEP: Handle Group Chat Creation / Assignment
    // =============================================
    // 1. Find if group chat already exists for this project
    let groupChat = await Chat.findOne({
      project: projectId,
      type: CHAT_TYPE.group,
      isDeleted: false,
    }).session(session)

    if (!groupChat) {
      // Create new group chat
      ;[groupChat] = await Chat.create(
        [
          {
            project: projectId,
            type: CHAT_TYPE.group,
            name: `${order.title} || ${order.finalAmount}`,
            image: null,
            status: CHAT_STATUS.active,
            isDeleted: false,
          },
        ],
        { session },
      )
    }

    // 2. Check if vendor is already a participant
    const existingParticipant = await Participant.findOne({
      chat: groupChat._id,
      user: order.sender,
      isDeleted: false,
    }).session(session)

    if (!existingParticipant) {
      // Add vendor as participant
      await Participant.create(
        [
          {
            chat: groupChat._id,
            user: order.sender,
            role: PARTICIPANT_ROLE.vendor, // vendor role
            status: PARTICIPANT_STATUS.active,
          },
        ],
        { session },
      )
    }

    // =============================================
    // Final updates & notifications
    // =============================================
    await session.commitTransaction()

    // Send notification to vendor
    await vendorProjectAssignNotify(
      order.sender as any,
      order,
      assignedProject[0].status,
      'bookings',
    )

    return assignedProject[0]
  } catch (error: any) {
    await session.abortTransaction()
    throw new AppError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || 'Project assignment failed',
    )
  } finally {
    session.endSession()
  }
}

// Get all assign project data
const getAllIntoDB = async (query: Record<string, any>) => {
  const AssignProjectModel = new QueryBuilder(
    AssignProject.find().populate([
      {
        path: 'vendor',
        select: 'name email photoUrl contractNumber address locationUrl',
      },
      {
        path: 'vendorOrder',
        select: 'title shortDescription address locationUrl',
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
const compareQuotes = async (
  id: string,
  query: Record<string, any>,
  userId: string,
) => {
  // Validate planner
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
      'File upload is only available in the Elite (Planner Pro / Agency) plan. ' +
        'Please upgrade your subscription',
    )
  }

  // Validate project record
  const project = await Project.findOne({
    _id: id,
    author: userId,
    isDeleted: false,
  })
  if (!project) {
    throw new AppError(httpStatus.NOT_FOUND, 'Project not found!')
  }

  const budgetProgress =
    project.budget > 0
      ? Math.min(Math.round((project.expense / project.budget) * 100), 100)
      : 0

  const assignProjectModel = new QueryBuilder(
    // @ts-ignore
    AssignProject.find({ project: id })
      .populate([
        {
          path: 'vendor',
          select: 'name photoUrl',
        },
      ])
      .select('vendor agreedAmount serviceType createdAt'),
    query,
  )
    .search([''])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await assignProjectModel.modelQuery
  const meta = await assignProjectModel.countTotal()

  return {
    data: {
      projectBudget: project.budget,
      projectExpense: project.expense,
      budgetProgress,
      vendorList: data,
    },
    meta,
  }
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
  const vendor = await User.findById(result.vendor)
  if (order && vendor) {
    await vendorProjectAssignNotify(vendor, order, status, 'bookings')
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
  compareQuotes,
  updateStatusIntoDB,
  deleteAIntoDB,
}
