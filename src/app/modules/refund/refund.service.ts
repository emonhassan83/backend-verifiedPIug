import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { TRefund } from './refund.interface'
import { Refund } from './refund.model'
import { User } from '../user/user.model'
import {
  refundAddNotifyToVendor,
  refundChangeStatusNotifyToUser,
} from './refund.utils'
import { Order } from '../order/order.models'
import { ORDER_STATUS, PAYMENT_STATUS } from '../order/order.constants'
import {
  REFUND_AUTHORITY,
  REFUND_STATUS,
  TRefundStatus,
} from './refund.constant'
import { startSession } from 'mongoose'
import { Payment } from '../payment/payment.model'
import { PAYMENT_MODEL_TYPE } from '../payment/payment.interface'
import { PAYMENT_TYPE } from '../payment/payment.constant'
import { refundPaystackPayment } from '../payment/payment.utils'
import { Project } from '../project/project.models'
import { PROJECT_STATUS } from '../project/project.constants'

const createRefundIntoDB = async (payload: TRefund, userId: string) => {
  const { order: orderId } = payload

  // 1. Find the order
  const order = await Order.findById(orderId)
  if (!order || order?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found!')
  }
  if (order.status === ORDER_STATUS.cancelled) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Only cancelled order eligible for refund!',
    )
  }

  // 2. Validate requesting user
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your profile not found!')
  }

  // 3. Get vendor’s balance
  const receiver = await User.findById(order.sender)
  if (!receiver || receiver?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Refound receiver not found!')
  }

  // 3.5. prevent duplicate refund
  const isExistRefund = await Refund.findOne({
    sender: userId,
    receiver: order.sender,
    status: REFUND_STATUS.pending,
  })
  if (isExistRefund) return isExistRefund

  // 4. Prepare and create refund
  const refundPayload: TRefund = {
    ...payload,
    authority: user.role as any,
    sender: userId,
    receiver: order.sender,
  }

  const refund = await Refund.create(refundPayload)
  if (!refund) {
    throw new AppError(httpStatus.CONFLICT, 'Refund request not created!')
  }

  // 5. Notify Receiver
  await refundAddNotifyToVendor('ADDED', user, receiver._id, refund)

  return refund
}

const getAllRefundsFromDB = async (query: Record<string, unknown>) => {
  const refundQuery = new QueryBuilder(
    Refund.find().populate([
      {
        path: 'sender',
        select: 'name photoUrl',
      },
      {
        path: 'receiver',
        select: 'name photoUrl',
      },
      {
        path: 'order',
        select: 'title',
      },
    ]),
    query,
  )
    .search([''])
    .filter()
    .sort()
    .paginate()
    .fields()

  const refunds = await refundQuery.modelQuery
  const meta = await refundQuery.countTotal()

  return {
    meta,
    result: refunds,
  }
}

const getARefundFromDB = async (id: string) => {
  // Step 1: Get the refund with related data
  const refund = await Refund.findById(id).populate([
    {
      path: 'sender',
      select: 'name photoUrl',
    },
    {
      path: 'receiver',
      select: 'name photoUrl',
    },
    {
      path: 'order',
    },
  ])
  if (!refund || refund?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Refund request not found')
  }

  return refund
}

const updateRefundStatusFromDB = async (
  id: string,
  payload: { status: TRefundStatus },
) => {
  const { status } = payload

  // 1. Validate status
  if (!Object.values(REFUND_STATUS).includes(status)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid refund status')
  }

  // 2. Start transaction
  const session = await startSession()
  session.startTransaction()

  try {
    // 3. Find refund request
    const refund = await Refund.findById(id).session(session)
    if (!refund || refund.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'Refund request not found!')
    }

    // 4. Prevent invalid transitions
    if (refund.status !== REFUND_STATUS.pending) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Refund request already ${refund.status}. Cannot change status again.`,
      )
    }

    // 6. If authority = "user" and status = "confirmed" → auto refund via Paystack
    if (
      refund.authority === REFUND_AUTHORITY.user &&
      status === REFUND_STATUS.confirmed
    ) {
      // Find linked payment
      const payment = await Payment.findOne({
        reference: refund.order,
        user: refund.sender,
        modelType: PAYMENT_MODEL_TYPE.Order,
        type: PAYMENT_TYPE.initial,
        isPaid: true,
        isDeleted: false,
      }).session(session)

      if (!payment || !payment.transactionId) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'No payment found for this order to refund',
        )
      }

      // Paystack-এ refund করো
      const refundResponse = await refundPaystackPayment(
        Number(payment.transactionId),
        `Refund requested by user for order ${refund.order}`,
      )
      if (!refundResponse?.status) {
        throw new AppError(
          httpStatus.INTERNAL_SERVER_ERROR,
          'Paystack refund failed',
        )
      }

      // Update payment status to refunded
      await Payment.findOneAndUpdate(
        { _id: payment._id },
        {
          status: PAYMENT_STATUS.refunded
        },
        { session },
      )

      // Update order refund fields
      await Order.findByIdAndUpdate(
        refund.order,
        {
          initialAmount: 0,
          pendingAmount: 0,
          status: ORDER_STATUS.refunded,
          initialPayment: {
            status: PAYMENT_STATUS.refunded
          },
        },
        { session },
      )

      // Optional: Reduce received in project if linked
      await Project.findOneAndUpdate(
        { order: refund.order },
        { $inc: { received: -payment.amount },  received: 0, status: PROJECT_STATUS.refunded },
        { session },
      )
    }

    // 7. Update refund status
    const updatedRefund = await Refund.findByIdAndUpdate(
      id,
      {
        status,
        processedAt: new Date(),
      },
      { new: true, session },
    )
    if (!updatedRefund) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Refund update failed',
      )
    }

    // 8. Notify user
    const user = await User.findById(refund.sender).session(session)
    if (user) {
      await refundChangeStatusNotifyToUser('CHANGED_STATUS', user, updatedRefund)
    }

    await session.commitTransaction()
    session.endSession()

    return updatedRefund
  } catch (error: any) {
    await session.abortTransaction()
    session.endSession()
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error.message || 'Failed to update refund status',
    )
  }
}

const deleteARefundFromDB = async (id: string) => {
  const refund = await Refund.findById(id)
  if (!refund || refund?.isDeleted) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'This Refund request is not found !',
    )
  }

  const result = await Refund.findByIdAndUpdate(
    id,
    {
      isDeleted: true,
    },
    { new: true },
  )
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Refund request Delete failed!')
  }

  return result
}

export const RefundServices = {
  createRefundIntoDB,
  getAllRefundsFromDB,
  getARefundFromDB,
  updateRefundStatusFromDB,
  deleteARefundFromDB,
}
