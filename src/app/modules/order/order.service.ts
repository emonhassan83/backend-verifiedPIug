import httpStatus from 'http-status'
import { TOrder } from './order.interface'
import QueryBuilder from '../../builder/QueryBuilder'
import { Order } from './order.models'
import AppError from '../../errors/AppError'
import { User } from '../user/user.model'
import { Types } from 'mongoose'
import {
  changeOrderStatusNotification,
  sendNewOrderNotification,
} from './order.utils'
import { ORDER_STATUS } from './order.constants'

const generateLocationUrl = (lat: number, lng: number) => {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

// Create a new Order
const insertIntoDB = async (userId: string, payload: TOrder) => {
  const {
    receiver: receiverId,
    latitude,
    longitude,
    duration,
    totalAmount,
  } = payload

  // 1. Validate sender (current logged-in user)
  const sender = await User.findById(userId).select('role status isDeleted')
  if (!sender || sender.isDeleted) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Your profile not found or deleted',
    )
  }

  // 2. Validate receiver
  const receiver = await User.findById(receiverId).select(
    'role status isDeleted',
  )
  if (!receiver || receiver.isDeleted) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Order receiver profile not found or deleted',
    )
  }

  // 3. Assign sender
  payload.authority = sender.role as any
  payload.sender = sender._id as Types.ObjectId

  // 4. Handle location
  if (latitude && longitude) {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Latitude and longitude must be numbers',
      )
    }

    payload.location = {
      type: 'Point',
      coordinates: [longitude, latitude], // MongoDB GeoJSON: [lng, lat]
    }

    payload.locationUrl = generateLocationUrl(latitude, longitude)
  }

  // 5. Auto-calculate endDate based on duration (assuming duration in days)
  if (duration && payload.startDate) {
    const start = new Date(payload.startDate)
    if (isNaN(start.getTime())) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid start date format')
    }

    const end = new Date(start)
    end.setDate(start.getDate() + duration)
    payload.endDate = end.toISOString().split('T')[0] // YYYY-MM-DD
  }

  // 6. Payment logic: initialAmount = 50% of totalAmount
  if (totalAmount) {
    payload.initialAmount = Number(totalAmount) / 2
    payload.pendingAmount = Number(totalAmount) - payload.initialAmount
    payload.finalAmount = payload.pendingAmount // initially same as pending
  } else {
    throw new AppError(httpStatus.BAD_REQUEST, 'Total amount is required')
  }

  // 7. Create the order
  const result = await Order.create(payload)
  if (!result) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Order creation failed',
    )
  }

  // 8. sent receiver to notify them
  await sendNewOrderNotification(receiverId, result)

  return result
}

// Get all Order
const getAllIntoDB = async (query: Record<string, any>) => {
  const OrderModel = new QueryBuilder(
    Order.find({ isDeleted: false }).populate([
      { path: 'sender', select: 'name photoUrl' },
      { path: 'receiver', select: 'name photoUrl' },
    ]),
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
  const result = await Order.findById(id).populate([
    { path: 'sender', select: 'name photoUrl' },
    { path: 'receiver', select: 'name photoUrl' },
  ])
  if (!result || result?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Oops! Order not found')
  }

  return result
}

// Update Order
const updateAIntoDB = async (id: string, payload: Partial<TOrder>) => {
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

  // if set canalled then must be order status running
  if (status === ORDER_STATUS.cancelled) {
    if (order.status !== ORDER_STATUS.running) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Order cannot be cancelled. Current status is "${order.status}". Cancellation is only allowed when status is "running".`,
      )
    }
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

  // Status change notification to BOTH sender and receiver
  await changeOrderStatusNotification(
    order.sender as Types.ObjectId,
    order.receiver as Types.ObjectId,
    order,
    status,
  )

  return result
}

// Delete Order
const deleteAIntoDB = async (id: string) => {
  // 1. Find the order first to check status
  const order = await Order.findById(id)
  if (!order || order?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found!')
  }

  // 2. Check if status is "pending"
  if (order.status !== ORDER_STATUS.pending) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Order cannot be deleted. Current status is "${order.status}". Only pending orders can be deleted.`,
    )
  }

  // 3. Soft delete (isDeleted = true)
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
    throw new AppError(httpStatus.BAD_REQUEST, 'Order deletion failed!')
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
