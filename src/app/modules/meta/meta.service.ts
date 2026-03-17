import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import { USER_ROLE, USER_STATUS } from '../user/user.constant'
import { User } from '../user/user.model'
import { getUserOverview } from './meta.utils'
import { Payment } from '../payment/payment.model'
import { PAYMENT_MODEL_TYPE } from '../payment/payment.interface'
import { Project } from '../project/project.models'
import { PROJECT_STATUS } from '../project/project.constants'
import { Order } from '../order/order.models'
import { ORDER_AUTHORITY, ORDER_STATUS } from '../order/order.constants'
import { Notification } from '../notification/notification.model'
import mongoose from 'mongoose'
import { PAYMENT_STATUS } from '../payment/payment.constant'
import { Banner } from '../banner/banner.models'
import { Category } from '../categories/categories.models'
import { ServiceService } from '../service/service.service'
import { SERVICE_AUTHORITY, SERVICE_STATUS } from '../service/service.constants'

const adminMetaData = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const { year } = query

  const user = await User.findById(userId)
  if (!user || user?.isDeleted || user.role !== USER_ROLE.admin) {
    throw new AppError(httpStatus.NOT_FOUND, 'Admin not found!')
  }

  const selectedYear = year
    ? parseInt(year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  // 1. user, planer and vendor count
  const totalUserCount = await User.countDocuments({
    role: USER_ROLE.user,
    status: USER_STATUS.active,
    isDeleted: false,
  })

  const totalPlanerCount = await User.countDocuments({
    role: USER_ROLE.planer,
    status: USER_STATUS.active,
    isDeleted: false,
  })

  const totalVendorCount = await User.countDocuments({
    role: USER_ROLE.vendor,
    status: USER_STATUS.active,
    isDeleted: false,
  })

  // 2. total subscriptionEarnings
  const totalSubscriptionEarnings = await Payment.aggregate([
    {
      $match: {
        modelType: PAYMENT_MODEL_TYPE.Subscription,
        status: 'paid',
        isPaid: true,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
      },
    },
  ]).then((result) => result[0]?.total || 0)

  // 3. revenueByCategory → order type wise brake down
  const revenueByCategory = await Payment.aggregate([
    {
      $match: {
        modelType: PAYMENT_MODEL_TYPE.Order,
        status: 'paid',
        isPaid: true,
        isDeleted: false,
      },
    },
    {
      $lookup: {
        from: 'orders',
        localField: 'reference',
        foreignField: '_id',
        as: 'order',
      },
    },
    { $unwind: '$order' },
    {
      $group: {
        _id: '$order.type',
        amount: { $sum: '$amount' },
      },
    },
    {
      $project: {
        category: '$_id',
        amount: 1,
        _id: 0,
      },
    },
    { $sort: { amount: -1 } },
  ])

  // ৪. recentUsers → users
  const recentUsers = await User.find({
    role: { $ne: USER_ROLE.admin },
    isDeleted: false,
  })
    .select('name email photoUrl address role status createdAt')
    .sort({ createdAt: -1 })
    .limit(5)

  // ৫. User register overview
  const userOverview = await getUserOverview(selectedYear)

  return {
    totalUserCount,
    totalPlanerCount,
    totalVendorCount,
    subscriptionEarnings: totalSubscriptionEarnings,
    revenueByCategory,
    recentUsers,
    userOverview,
  }
}

const planerMetaData = async (userId: string) => {
  const user = await User.findById(userId)
  if (!user || user?.isDeleted || user.role !== USER_ROLE.planer) {
    throw new AppError(httpStatus.NOT_FOUND, 'Planer not found!')
  }

  // Today in string format
  const todayStr = new Date().toISOString().split('T')[0]

  // 1. active project, upcoming event and new lead count
  const activeProjectCount = await Project.countDocuments({
    author: userId,
    status: PROJECT_STATUS.ongoing,
    isDeleted: false,
  })

  const upcomingEventCount = await Order.countDocuments({
    receiver: userId,
    authority: ORDER_AUTHORITY.client,
    status: { $in: [ORDER_STATUS.running, ORDER_STATUS.pending] },
    startDate: { $gte: todayStr },
    isDeleted: false,
  })

  const newLeadCount = await Order.aggregate([
    {
      $match: {
        receiver: new mongoose.Types.ObjectId(userId),
        status: { $nin: [ORDER_STATUS.cancelled, ORDER_STATUS.denied] },
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: '$sender',
        orderCount: { $sum: 1 },
      },
    },
    {
      $match: {
        orderCount: 1, // only first-time clients
      },
    },
    {
      $count: 'newLeads',
    },
  ]).then((result) => result[0]?.newLeads || 0)

  // 2. total author Earnings
  const totalEarnings = await Payment.aggregate([
    {
      $match: {
        modelType: PAYMENT_MODEL_TYPE.Order,
        reference: { $in: await Order.distinct('_id', { receiver: userId }) },
        status: PAYMENT_STATUS.paid,
        isPaid: true,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$authorEarning' },
      },
    },
  ]).then((result) => result[0]?.total || 0)

  // 3. Upcoming event data (last 5 upcoming/running orders with startDate >= today)
  const upcomingEvents = await Order.find({
    receiver: userId,
    authority: ORDER_AUTHORITY.client,
    status: { $in: [ORDER_STATUS.running, ORDER_STATUS.pending] },
    startDate: { $gte: todayStr },
    isDeleted: false,
  })
    .select('title type startDate status')
    .sort({ startDate: 1 }) // earliest upcoming first
    .limit(5)

  // 3. recentNotify → Client
  const recentNotification = await Notification.find({
    receiver: userId,
    isDeleted: false,
  })
    .select('message description model_type read createdAt')
    .sort({ createdAt: -1 })
    .limit(3)

  return {
    activeProjectCount,
    upcomingEventCount,
    newLeadCount,
    totalEarnings,
    upcomingEvents,
    recentNotification,
  }
}

const vendorMetaData = async (userId: string) => {
  const user = await User.findById(userId)
  if (!user || user?.isDeleted || user.role !== USER_ROLE.vendor) {
    throw new AppError(httpStatus.NOT_FOUND, 'Vendor not found!')
  }

  // Today in string format (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0]

  // 1. Active Booking Count (running orders where vendor is receiver)
  const activeBookingCount = await Order.countDocuments({
    sender: new mongoose.Types.ObjectId(userId),
    authority: ORDER_AUTHORITY.vendor,
    status: ORDER_STATUS.running,
    isDeleted: false,
  })

  // 2. Total Booking Count (all non-cancelled/denied orders)
  const totalBookingCount = await Order.countDocuments({
    sender: new mongoose.Types.ObjectId(userId),
    authority: ORDER_AUTHORITY.vendor,
    status: { $nin: [ORDER_STATUS.cancelled, ORDER_STATUS.denied] },
    isDeleted: false,
  })

  // 3. Monthly Revenue (last 30 days earning after 3% commission deduction)
  const lastMonthStart = new Date()
  lastMonthStart.setDate(lastMonthStart.getDate() - 30)
  lastMonthStart.setHours(0, 0, 0, 0)

  const monthlyRevenueResult = await Order.aggregate([
    {
      $match: {
        sender: new mongoose.Types.ObjectId(userId),
        authority: ORDER_AUTHORITY.vendor,
        status: ORDER_STATUS.completed,
        isDeleted: false,
        actualEndDate: { $gte: lastMonthStart }, // completed in last 30 days
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$totalAmount' },
      },
    },
  ])

  const monthlyTotalAmount = monthlyRevenueResult[0]?.totalAmount || 0
  const monthlyRevenueAfterCommission = monthlyTotalAmount * 0.97 // 3% commission deducted

  // 4. Total Earning (all-time after 3% commission)
  const totalEarningResult = await Order.aggregate([
    {
      $match: {
        sender: new mongoose.Types.ObjectId(userId),
        authority: ORDER_AUTHORITY.vendor,
        status: ORDER_STATUS.completed,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$totalAmount' },
      },
    },
  ])

  const totalAmountAllTime = totalEarningResult[0]?.totalAmount || 0
  const totalEarningsAfterCommission = totalAmountAllTime * 0.97 // 3% commission deducted

  // 5. Upcoming Bookings (startDate >= today + status running/pending)
  const upcomingBooking = await Order.find({
    sender: new mongoose.Types.ObjectId(userId),
    authority: ORDER_AUTHORITY.vendor,
    status: { $in: [ORDER_STATUS.running, ORDER_STATUS.pending] },
    startDate: { $gte: todayStr },
    isDeleted: false,
  })
    .select('title type startDate endDate status')
    .sort({ startDate: 1 }) // earliest first
    .limit(5)

  // 6. Top Partnerships (top 4 planners with most orders from this vendor)
  const topPartnerships = await Order.aggregate([
    {
      $match: {
        sender: new mongoose.Types.ObjectId(userId),
        authority: ORDER_AUTHORITY.vendor,
        status: { $nin: [ORDER_STATUS.cancelled, ORDER_STATUS.denied] },
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: '$receiver', // planner ID
        orderCount: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'planner',
      },
    },
    { $unwind: '$planner' },
    {
      $project: {
        plannerName: '$planner.name',
        plannerEmail: '$planner.email',
        plannerPhoto: '$planner.photoUrl',
        orderCount: 1,
        rating: '$planner.avgRating',
        _id: 0,
      },
    },
    { $sort: { orderCount: -1 } },
    { $limit: 4 },
  ])

  return {
    activeBookingCount,
    totalBookingCount,
    monthlyRevenue: Math.round(monthlyRevenueAfterCommission), // last 30 days after commission
    totalEarnings: Math.round(totalEarningsAfterCommission), // all-time after commission
    upcomingBooking,
    topPartnerships,
  }
}

const userMetaData = async (userId: string) => {
  const user = await User.findById(userId)
  if (!user || user?.isDeleted || user.role !== USER_ROLE.user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  // Today in string format (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0]

  // get banners
  const banners = await Banner.find().select('url')

  // get categories
  const categories = await Category.find().select('title logo')

  // Upcoming Bookings (startDate >= today + status running/pending)
  const upcomingBooking = await Order.find({
    receiver: new mongoose.Types.ObjectId(userId),
    authority: ORDER_AUTHORITY.client,
    status: { $in: [ORDER_STATUS.running, ORDER_STATUS.pending] },
    startDate: { $gte: todayStr },
    isDeleted: false,
  })
    .select('title type startDate endDate status')
    .sort({ startDate: 1 }) // earliest first
    .limit(3)

  // Recommend service based on user location
  const recommendService = await ServiceService.getAllRecommendServices(
    { limit: 2 },
    userId,
  )
  const modifiedRecommend = recommendService.data

  // Recommend service based on user location
  const planerService = await ServiceService.getAllIntoDB(
    {
      limit: 2,
      status: SERVICE_STATUS.active,
      authority: SERVICE_AUTHORITY.planer,
    },
    userId,
  )
  const modifiedServices = planerService.data

  return {
    banners,
    categories,
    upcomingBooking,
    recommendServices: modifiedRecommend,
    planerService: modifiedServices,
  }
}

export const MetaService = {
  adminMetaData,
  planerMetaData,
  vendorMetaData,
  userMetaData,
}
