import httpStatus from 'http-status'
import { Project } from './project.models'
import AppError from '../../errors/AppError'
import { User } from '../user/user.model'
import { AssignProject } from '../assignProject/assignProject.models'
import { Task } from '../task/task.models'
import { USER_ROLE, USER_STATUS } from '../user/user.constant'
import QueryBuilder from '../../builder/QueryBuilder'
import { Order } from '../order/order.models'

// Create a new Project
const projectPaymentOverview = async (
  id: string,
  userId: string,
  query: Record<string, any>,
) => {
  const user = await User.findOne({
    _id: userId,
    role: USER_ROLE.planer,
    status: USER_STATUS.active,
    isDeleted: false,
  })
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your profile not found')
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

  // Fetch all assigned vendor payments for this project
  const AssignProjectModel = new QueryBuilder(
    AssignProject.find({ project: id }).populate([
      {
        path: 'vendor',
        select: 'name email photoUrl contractNumber',
      },
      {
        path: 'vendorOrder',
        select: 'title',
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

  // ──────────────────────────────────────────────
  // 1. totalReceived: Based on order's payment completion
  // ──────────────────────────────────────────────
  let totalReceived = 0

  const order = await Order.findById(project.order).lean()
  if (order) {
    // Include initial amount if initial payment completed
    if (order.initialPayCompleted && order.initialAmount) {
      totalReceived += order.initialAmount
    }

    // Include full/final amount if final payment completed
    if (order.finalPayCompleted && order.totalAmount) {
      totalReceived += order.totalAmount
    }
  }

  // ──────────────────────────────────────────────
  // 2. pendingPayment: Sum of agreedAmount where paymentStatus = pending
  // ──────────────────────────────────────────────
  const pendingPayment = order?.pendingAmount || 0

  // ──────────────────────────────────────────────
  // 3. Other existing calculations (vendorPayment & totalSaved)
  // ──────────────────────────────────────────────
  const vendorPayment = data.reduce(
    (sum, vp) => sum + (vp.agreedAmount || 0),
    0,
  )

  const totalSaved = totalReceived - vendorPayment

  return {
    data: {
      totalReceived,
      pendingPayment,
      vendorPayment,
      totalSaved,
      payments: data,
    },
    meta,
  }
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
    status: { $in: ['assigned', 'inProgress', 'completed'] },
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
  projectPaymentOverview,
  getAIntoDB,
  changeStatusFromDB,
}
