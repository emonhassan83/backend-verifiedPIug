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

const createRefundIntoDB = async (payload: TRefund, userId: string) => {
  const { order: orderId } = payload

  // 1. Find the order
  const order = await Order.findById(orderId)
  if (!order) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Order not found!')
  }

  // 2. Validate requesting user
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is not available!')
  }

  // 3. Get vendor’s balance
  const receiver = await User.findById(order.sender)
  if (!receiver || receiver?.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Refound receiver not found!')
  }

  // 4. Prepare and create refund
  const refundPayload: TRefund = {
    ...payload,
    sender: order.sender,
    receiver: order.receiver,
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
  payload: Partial<TRefund>,
) => {
  const refund = await Refund.findById(id)
  if (!refund || refund?.isDeleted) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'This Refund request is not found !',
    )
  }

  const updateRefund = await Refund.findByIdAndUpdate(id, payload, {
    new: true,
  })
  if (!updateRefund) {
    throw new AppError(httpStatus.NOT_FOUND, 'Refund request not updated')
  }

  // Find refund author (user)
  const user = await User.findById(refund.receiver)
  if (user) {
    await refundChangeStatusNotifyToUser('CHANGED_STATUS', user, updateRefund)
  }

  return updateRefund
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
