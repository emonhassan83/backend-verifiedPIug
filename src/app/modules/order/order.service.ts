import httpStatus from 'http-status'
import { TOrder } from './order.interface'
import QueryBuilder from '../../builder/QueryBuilder'
import { Order } from './order.models'
import AppError from '../../errors/AppError'
import { User } from '../user/user.model'
import mongoose, { Types } from 'mongoose'
import {
  changeOrderStatusNotification,
  sendNewOrderNotification,
} from './order.utils'
import { ORDER_AUTHORITY, ORDER_STATUS, TOrderStatus } from './order.constants'
import { Refund } from '../refund/refund.model'
import { REFUND_STATUS } from '../refund/refund.constant'
import { Payment } from '../payment/payment.model'
import { USER_ROLE } from '../user/user.constant'
import { PAYMENT_MODEL_TYPE } from '../payment/payment.interface'
import { AssignProject } from '../assignProject/assignProject.models'

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
  if (sender.role === USER_ROLE.planer) {
    payload.authority = ORDER_AUTHORITY.client
  } else if (sender.role === USER_ROLE.vendor) {
    payload.authority = ORDER_AUTHORITY.vendor
  }
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
  if (totalAmount && sender.role === USER_ROLE.planer) {
    payload.initialAmount = Number(totalAmount) / 2
    payload.pendingAmount = Number(totalAmount) - payload.initialAmount
    payload.finalAmount = payload.pendingAmount // initially same as pending
  } else if (totalAmount && sender.role === USER_ROLE.vendor) {
    payload.initialAmount = 0
    payload.pendingAmount = Number(totalAmount)
    payload.finalAmount = Number(totalAmount)
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
  await sendNewOrderNotification(receiverId, result, 'bookings')

  return result
}

// Get all Order
const getAllIntoDB = async (query: Record<string, any>) => {
  const OrderModel = new QueryBuilder(
    Order.find({
      isDeleted: false,
    }).populate([
      { path: 'sender', select: 'name photoUrl address isKycVerified' },
      { path: 'receiver', select: 'name photoUrl address isKycVerified' },
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

const getMyIntoDB = async (query: Record<string, any>, userId: string) => {
  const baseQuery = {
    $or: [{ sender: userId }, { receiver: userId }],
    isDeleted: false,
  };

  const OrderModel = new QueryBuilder(
    Order.find(baseQuery).populate([
      { path: 'sender', select: 'name photoUrl isKycVerified' },
      { path: 'receiver', select: 'name photoUrl isKycVerified' },
    ]),
    query,
  )
    .search(['title'])
    .filter()
    .paginate()
    .sort()
    .fields();

  // Raw orders data আনা
  let data = await OrderModel.modelQuery.lean();

  // Step 1: সব order-এর _id সংগ্রহ করা
  const orderIds = data.map((order: any) => order._id);

  // Step 2: একসাথে সব order-এর জন্য AssignProject চেক করা (performance-এর জন্য bulk query)
  const assignedOrders = await AssignProject.find(
    {
      vendorOrder: { $in: orderIds }
    },
    { vendorOrder: 1 }
  ).lean();

  // Step 3: assigned order-গুলোর set তৈরি করা (দ্রুত lookup-এর জন্য)
  const assignedOrderSet = new Set(
    assignedOrders.map((assign: any) => assign.vendorOrder.toString())
  );

  // Step 4: প্রতিটি order-এ isAssigned ফিল্ড যোগ করা
  data = data.map((order: any) => ({
    ...order,
    isAssigned: assignedOrderSet.has(order._id.toString()),
  }));

  const meta = await OrderModel.countTotal();

  return {
    data,
    meta,
  };
};

// Get Order by ID
const getAIntoDB = async (id: string) => {
  const result = await Order.findById(id).populate([
    {
      path: 'sender',
      select:
        'name photoUrl categories email contractNumber address location locationUrl avgRating ratingCount isKycVerified',
    },
    {
      path: 'receiver',
      select:
        'name photoUrl categories email contractNumber address location locationUrl avgRating ratingCount isKycVerified',
    },
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

const cancelOrderFromDB = async (
  id: string,
  payload: { reason: string; note?: string },
  userId: string,
) => {
  const { reason, note } = payload

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // 1. Find user
    const user = await User.findById(userId).session(session)
    if (!user || user.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
    }

    // 2. Find order
    const order = await Order.findById(id).session(session)
    if (!order || order.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'Order not found!')
    }

    // 3. Authorization: only sender or receiver can cancel
    const isAuthorized =
      order.sender.toString() === userId || order.receiver.toString() === userId
    if (!isAuthorized) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You are not allowed to cancel this order',
      )
    }

    // 4. Strict status check: only running orders can be cancelled
    if (order.status !== ORDER_STATUS.running) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Order cannot be cancelled. Current status is "${order.status}". Cancellation is only allowed when status is "running".`,
      )
    }

    // ──────────────────────────────────────────────
    // NEW LOGIC: Skip refund steps if authority is 'vendor'
    // ──────────────────────────────────────────────
    const isVendorAuthority = order.authority === ORDER_AUTHORITY.vendor

    if (!isVendorAuthority) {
      // Step 5: Check if any paid payment exists
      const payment = await Payment.findOne({
        reference: order._id,
        modelType: PAYMENT_MODEL_TYPE.Order,
        isPaid: true,
        isDeleted: false,
      }).session(session)

      if (!payment) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'No valid paid payment found for this order. Cancellation not allowed without payment.',
        )
      }

      // Step 6: Prevent duplicate refund request
      const existingRefund = await Refund.findOne({
        order: id,
        user: userId,
        status: REFUND_STATUS.pending,
      }).session(session)

      if (existingRefund) {
        throw new AppError(
          httpStatus.CONFLICT,
          'Refund request already submitted for this order',
        )
      }

      // Step 7: Create new refund request
      await Refund.create(
        [
          {
            user: userId,
            order: order._id,
            paymentIntentId: payment.paymentIntentId,
            amount: 0, // amount will be updated after approval
            reason,
            note: note || 'User cancelled order',
            status: REFUND_STATUS.pending,
          },
        ],
        { session },
      )
    } else {
      // When authority is 'vendor' → skip refund entirely
      console.log(
        `Order ${order._id} has authority 'vendor' — skipping refund steps`,
      )
    }

    // 8. Update order status to cancelled
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { status: ORDER_STATUS.cancelled },
      { new: true, session },
    )

    if (!updatedOrder) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Failed to update order status',
      )
    }

    // 9. Send status change notification to BOTH parties
    await changeOrderStatusNotification(
      order.sender,
      order.receiver,
      updatedOrder,
      'cancelled',
      'bookings',
    )

    // 10. Commit transaction
    await session.commitTransaction()

    return updatedOrder
  } catch (error) {
    await session.abortTransaction()
    throw error instanceof AppError
      ? error
      : new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to cancel order')
  } finally {
    session.endSession()
  }
}

const changeStatusFromDB = async (
  id: string,
  payload: { status: TOrderStatus },
  userId: string,
) => {
  const { status } = payload

  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found!')
  }

  const order = await Order.findById(id)
  if (!order || order?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found!')
  }

  // 🔐 Authorization
  const isAuthorized =
    order.sender.toString() === userId || order.receiver.toString() === userId
  if (!isAuthorized) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not allowed to change this order status',
    )
  }

  // Update order status
  const result = await Order.findByIdAndUpdate(
    order._id,
    { status },
    { new: true },
  )

  // Status change notification to BOTH sender and receiver
  await changeOrderStatusNotification(
    order.sender as Types.ObjectId,
    order.receiver as Types.ObjectId,
    order,
    status,
    'bookings',
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
  getMyIntoDB,
  getAIntoDB,
  updateAIntoDB,
  cancelOrderFromDB,
  changeStatusFromDB,
  deleteAIntoDB,
}
