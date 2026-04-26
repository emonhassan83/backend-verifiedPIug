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
  const user = await User.findById(userId);
  if (!user || user?.isDeleted || user.role !== USER_ROLE.planer) {
    throw new AppError(httpStatus.NOT_FOUND, 'Planer not found!');
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Active Project Count
  const activeProjectCount = await Project.countDocuments({
    author: userId,
    status: PROJECT_STATUS.ongoing,
    isDeleted: false,
  });

  // 2. Upcoming Event Count
  const upcomingEventCount = await Order.countDocuments({
    sender: userId,
    authority: ORDER_AUTHORITY.client,
    status: { $in: [ORDER_STATUS.running, ORDER_STATUS.pending] },
    startDate: { $gte: todayStr },
    isDeleted: false,
  });

  // 3. New Lead Count
  const newLeadCount = await Order.aggregate([
    {
      $match: {
        sender: new mongoose.Types.ObjectId(userId),
        authority: ORDER_AUTHORITY.client,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: '$receiver',
        orderCount: { $sum: 1 },
        firstOrder: { $min: '$createdAt' },
      },
    },
    { $match: { orderCount: 1 } },
    { $count: 'newLeads' },
  ]).then((result) => result[0]?.newLeads || 0);

  // 4. Total Earnings
  const totalEarnings = await Payment.aggregate([
    {
      $match: {
        modelType: PAYMENT_MODEL_TYPE.Order,
        reference: { $in: await Order.distinct('_id', { sender: userId }) },
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
  ]).then((result) => result[0]?.total || 0);

  // Recommend service based on user location
  const recommendService = await ServiceService.getAllRecommendServices(
    { limit: 2 },
    userId,
  )
  const modifiedRecommend = recommendService.data

  // 5. Upcoming Events with correct sorting: Running first, then Pending
  const upcomingEvents = await Order.find({
    sender: userId,
    authority: ORDER_AUTHORITY.client,
    status: { $in: [ORDER_STATUS.running, ORDER_STATUS.pending] },
    startDate: { $gte: todayStr },
    isDeleted: false,
  })
    .select('title type startDate status')
    .sort({
      status: -1,        // running (comes first) > pending
      startDate: 1,      // তারপর earliest date
    })
    .limit(5);

  // 6. Recent Notifications
  const recentNotification = await Notification.find({
    receiver: userId,
    isDeleted: false,
  })
    .select('message description model_type read createdAt')
    .sort({ createdAt: -1 })
    .limit(3);

  return {
    activeProjectCount,
    upcomingEventCount,
    newLeadCount,
    totalEarnings,
    recommendServices: modifiedRecommend,
    upcomingEvents,        // ← এখন running আগে, pending পরে
    recentNotification,
  };
};

const vendorMetaData = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user || user?.isDeleted || user.role !== USER_ROLE.vendor) {
    throw new AppError(httpStatus.NOT_FOUND, 'Vendor not found!');
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // Active & Total Booking Count
  const activeBookingCount = await Order.countDocuments({
    sender: new mongoose.Types.ObjectId(userId),
    authority: ORDER_AUTHORITY.vendor,
    status: ORDER_STATUS.running,
    isDeleted: false,
  });

  const totalBookingCount = await Order.countDocuments({
    sender: new mongoose.Types.ObjectId(userId),
    authority: ORDER_AUTHORITY.vendor,
    status: { $nin: [ORDER_STATUS.cancelled, ORDER_STATUS.denied] },
    isDeleted: false,
  });

  // Monthly & Total Earnings
  const lastMonthStart = new Date();
  lastMonthStart.setDate(lastMonthStart.getDate() - 30);
  lastMonthStart.setHours(0, 0, 0, 0);

  const monthlyRevenueResult = await Order.aggregate([
    {
      $match: {
        sender: new mongoose.Types.ObjectId(userId),
        authority: ORDER_AUTHORITY.vendor,
        status: ORDER_STATUS.completed,
        isDeleted: false,
        actualEndDate: { $gte: lastMonthStart },
      },
    },
    { $group: { _id: null, totalAmount: { $sum: '$totalAmount' } } },
  ]);

  const monthlyRevenue = Math.round((monthlyRevenueResult[0]?.totalAmount || 0) * 0.97);

  const totalEarningResult = await Order.aggregate([
    {
      $match: {
        sender: new mongoose.Types.ObjectId(userId),
        authority: ORDER_AUTHORITY.vendor,
        status: ORDER_STATUS.completed,
        isDeleted: false,
      },
    },
    { $group: { _id: null, totalAmount: { $sum: '$totalAmount' } } },
  ]);

  const totalEarnings = Math.round((totalEarningResult[0]?.totalAmount || 0) * 0.97);

  // Recommend service based on user location
  const recommendService = await ServiceService.getAllRecommendServices(
    { limit: 2 },
    userId,
  )
  const modifiedRecommend = recommendService.data

  // Upcoming Bookings with correct priority: Running first, then Pending
  const upcomingBooking = await Order.find({
    sender: new mongoose.Types.ObjectId(userId),
    authority: ORDER_AUTHORITY.vendor,
    status: { $in: [ORDER_STATUS.running, ORDER_STATUS.pending] },
    startDate: { $gte: todayStr },
    isDeleted: false,
  })
    .select('title type startDate endDate status')
    .sort({
      status: -1,      // running আগে (running > pending)
      startDate: 1,  
    })
    .limit(5);

  // Top Partnerships
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
        _id: '$receiver',
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
  ]);

  return {
    activeBookingCount,
    totalBookingCount,
    monthlyRevenue,
    totalEarnings,
    recommendServices: modifiedRecommend,
    upcomingBooking,
    topPartnerships,
  };
};

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
