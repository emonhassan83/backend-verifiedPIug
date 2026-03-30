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
import { ASSIGNMENT_PAYMENT_STATUS, TVendorAssignmentStatus, VENDOR_ASSIGNMENT_STATUS } from './assignProject.constants'
import { vendorProjectAssignNotify } from './assignProject.utils'
import { Chat } from '../chat/chat.models'
import { CHAT_STATUS } from '../chat/chat.constants'
import { Participant } from '../participant/participant.models'
import {
  PARTICIPANT_ROLE,
  PARTICIPANT_STATUS,
} from '../participant/participant.constants'
import { PROJECT_STATUS } from '../project/project.constants'
import { USER_ROLE, USER_STATUS } from '../user/user.constant'
import { checkSubscriptionPermission } from '../../utils/subscription.utils'
import axios from 'axios'
import config from '../../config'
import { modelType } from '../chat/chat.interface'
import { Withdraw } from '../withdraw/withdraw.model'
import { WITHDRAW_AUTHORITY, WITHDRAW_METHOD, WITHDRAW_STATUS } from '../withdraw/withdraw.constant'
import { PaystackRecipient } from '../paystackRecipient/paystackRecipient.model'

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
      reference: projectId,
      modelType: modelType.Project,
      isDeleted: false,
    }).session(session)

    if (!groupChat) {
      // Create new group chat
      ;[groupChat] = await Chat.create(
        [
          {
            reference: projectId,
            modelType: modelType.Project,
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


// Make a payment to a vendor for a project
const makeAVendorPayment = async (id: string, userId: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Validate planner (only planner can pay vendor)
    const planner = await User.findById(userId).session(session);
    if (!planner || planner.isDeleted || planner.role !== USER_ROLE.planer) {
      throw new AppError(httpStatus.NOT_FOUND, 'Planner profile not found or invalid');
    }

    // 2. Find AssignProject
    const assignProject = await AssignProject.findById(id)
      .populate('vendor')
      .populate('project')
      .session(session);

    if (!assignProject) {
      throw new AppError(httpStatus.NOT_FOUND, 'Assign project not found');
    }

    // 3. Corner case: Prevent duplicate payment
    if (assignProject.paymentStatus === ASSIGNMENT_PAYMENT_STATUS.paid) {
      throw new AppError(
        httpStatus.CONFLICT,
        'This vendor has already been paid for this assignment'
      );
    }

    if (assignProject.status === VENDOR_ASSIGNMENT_STATUS.completed) {
      throw new AppError(
        httpStatus.CONFLICT,
        'This assignment is already marked as completed'
      );
    }

    // 4. Check planner balance
    if (planner.balance < assignProject.agreedAmount) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Insufficient balance. You need ₦${assignProject.agreedAmount} but you have ₦${planner.balance}`
      );
    }

    // 5. Get vendor's Paystack recipient code
    const vendor = assignProject.vendor as any
    const vendorRecipient =  await PaystackRecipient.findOne({
      user: vendor._id,
      isDefault: true,
      isDeleted: false,
    }).session(session)
    if (!vendorRecipient || !vendorRecipient.recipientCode) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Vendor has not connected their Paystack account yet'
      );
    }

    // 6. Perform secure Paystack transfer (planner → vendor)
    const transferResponse = await axios.post(
      'https://api.paystack.co/transfer',
      {
        source: 'balance',
        amount: assignProject.agreedAmount * 100, // kobo
        recipient: vendorRecipient.recipientCode,
        reason: `Payment for project ${assignProject.project?._id} - ${assignProject.serviceType?.join(', ')}`,
      },
      {
        headers: {
          Authorization: `Bearer ${config.paystack.secret_key}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!transferResponse.data.status) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Paystack transfer failed. Please try again.'
      );
    }

    const transferData = transferResponse.data.data;

    // 7. Update balances atomically
    await User.findByIdAndUpdate(
      planner._id,
      { $inc: { balance: -assignProject.agreedAmount } },
      { session }
    );

    await User.findByIdAndUpdate(
      vendor._id,
      { $inc: { balance: assignProject.agreedAmount } },
      { session }
    );

    // 8. Update AssignProject status and payment
    const updatedAssignProject = await AssignProject.findByIdAndUpdate(
      id,
      {
        paidAmount: assignProject.agreedAmount,
        paymentStatus: ASSIGNMENT_PAYMENT_STATUS.paid,
        status: VENDOR_ASSIGNMENT_STATUS.completed,
        completedDate: new Date().toISOString().split('T')[0],
      },
      { new: true, session }
    );

    // 🔥 9. CREATE WITHDRAW RECORD for vendor
    const withdrawRecord = await Withdraw.create(
      [
        {
          user: vendor._id, // Vendor who receives payment
          order: assignProject.vendorOrder, // Project reference
          reference: assignProject._id, // AssignProject as payment reference
          authority: WITHDRAW_AUTHORITY.vendor,
          method: WITHDRAW_METHOD.playstack,
          amount: assignProject.agreedAmount,
          paystackTransferId: transferData.id || transferData.transfer_code,
          recipientCode: vendor.playstackRecipientCode,
          note: `Payment received from planner for project services: ${assignProject.serviceType?.join(', ')}`,
          proceedAt: new Date(),
          status: WITHDRAW_STATUS.completed,
        },
      ],
      { session }
    );

    // 10. Commit transaction
    await session.commitTransaction();

    // Optional: Send notification to both parties
    await vendorProjectAssignNotify(
      vendor._id,
      assignProject.vendorOrder,
      'make_as_payment',
      'bookings',
      updatedAssignProject
    );

    return {
      success: true,
      message: 'Payment successfully transferred to vendor',
      data: {
        assignProject: updatedAssignProject,
        withdraw: withdrawRecord[0],
      },
      transferId: transferData.id,
    };
  } catch (error: any) {
    await session.abortTransaction();
    throw error instanceof AppError
      ? error
      : new AppError(
          httpStatus.INTERNAL_SERVER_ERROR,
          error.message || 'Vendor payment failed'
        );
  } finally {
    session.endSession();
  }
};

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
  makeAVendorPayment,
  compareQuotes,
  updateStatusIntoDB,
  deleteAIntoDB,
}
