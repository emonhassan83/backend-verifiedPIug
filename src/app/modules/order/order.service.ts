import httpStatus from 'http-status'
import { TOrder } from './order.interface'
import QueryBuilder from '../../builder/QueryBuilder'
import { Order } from './order.models'
import AppError from '../../errors/AppError'
import { uploadToS3 } from '../../utils/s3'
import { User } from '../user/user.model'
import { Category } from '../categories/categories.models'

// Create a new Order
const insertIntoDB = async (userId: string, payload: TOrder) => {
  const { receiver: receiverId, type, project: projectId } = payload

  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your profile not found')
  }

  const receiver = await User.findById(receiverId)
  if (!receiver || receiver?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order receiver profile not found')
  }

  // Assign to payload
  payload.author = user._id

  const result = await Order.create(payload)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Order creation failed')
  }

  return result
}

// Get all Order
const getAllIntoDB = async (query: Record<string, any>) => {
  const OrderModel = new QueryBuilder(
    Order.find({ isDeleted: false }),
    query,
  )
    .search(['title'])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await OrderModel.modelQuery
  const meta = await OrderModel.countTotal()
  return {
    data,
    meta,
  }
}

// Get Order by ID
const getAIntoDB = async (id: string) => {
  const result = await Order.findById(id)
  if (!result || result?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Oops! Order not found')
  }

  return result
}

// Update Order
const updateAIntoDB = async (
  id: string,
  payload: Partial<TOrder>
) => {
  const order = await Order.findById(id)
  if (!order || order?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found!')
  }

  const result = await Order.findByIdAndUpdate(id, payload, {
    new: true,
  })
  if (!result) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Order record not updated!',
    )
  }

  return result
}

const changeStatusFromDB = async (id: string, payload: any) => {
  const { status } = payload

  const order = await Order.findById(id)
  if (!order || order?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found!')
  }

  const result = await Order.findByIdAndUpdate(
    order._id,
    { status },
    { new: true },
  )
  if (!result) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'User not found and failed to update status!',
    )
  }

  return result
}

// Delete Order
const deleteAIntoDB = async (id: string) => {
  const result = await Order.findByIdAndUpdate(
    id,
    {
      $set: {
        isDeleted: true,
      },
    },
    { new: true },
  )

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Order deletion failed')
  }

  return result
}

export const OrderService = {
  insertIntoDB,
  getAllIntoDB,
  getAIntoDB,
  updateAIntoDB,
  changeStatusFromDB,
  deleteAIntoDB,
}
