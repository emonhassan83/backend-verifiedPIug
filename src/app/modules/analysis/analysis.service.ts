import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import { USER_ROLE, USER_STATUS } from '../user/user.constant'
import { User } from '../user/user.model'
import { Payment } from '../payment/payment.model'
import { PAYMENT_MODEL_TYPE } from '../payment/payment.interface'
import { Order } from '../order/order.models'
import { PAYMENT_STATUS } from '../payment/payment.constant'
import { Subscription } from '../subscription/subscription.models'
import { SUBSCRIPTION_STATUS } from '../subscription/subscription.constants'
import {
  authorOrderCountOverview,
  getEarningOverview,
  planerCommonMeta,
  revenueGrowthOverview,
  subscriptionEarning,
  vendorOrderResult,
} from './analysis.utils'

const adminAnalysisData = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const { order_year, subscription_year, booking_year } = query

  const admin = await User.findById(userId)
  if (!admin || admin?.isDeleted || admin.role !== USER_ROLE.admin) {
    throw new AppError(httpStatus.NOT_FOUND, 'Admin not found!')
  }

  const selectedOrderYear = order_year
    ? parseInt(order_year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  const selectedSubscriptionYear = subscription_year
    ? parseInt(subscription_year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  const selectedBookingYear = booking_year
    ? parseInt(booking_year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  // 1. totalUserCount
  const totalUserCount = await User.countDocuments({
    role: USER_ROLE.user,
    status: USER_STATUS.active,
    isDeleted: false,
  })

  // 2. avgBooking (average order value from paid orders)
  const avgBookingResult = await Payment.aggregate([
    {
      $match: {
        modelType: PAYMENT_MODEL_TYPE.Order,
        status: PAYMENT_STATUS.paid,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        avgAmount: { $avg: '$amount' },
      },
    },
  ])

  const avgBookingValue = Math.round(avgBookingResult[0]?.avgAmount || 0)

  // 3. activeSubscriptionCount
  const activeSubscriptionCount = await Subscription.countDocuments({
    status: SUBSCRIPTION_STATUS.active,
    isDeleted: false,
  })

  // 4. totalEarning (all paid payments sum)
  const totalEarningResult = await Payment.aggregate([
    {
      $match: {
        status: PAYMENT_STATUS.paid,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
      },
    },
  ])

  const totalEarning = totalEarningResult[0]?.total || 0

  // 5. earningOverview (monthly breakdown for planner & vendor earnings from completed orders)
  const earningOverview = await getEarningOverview(selectedOrderYear)
  const earningOverviewData = {
    planerEarningOverview: earningOverview.map((item) => ({
      month: item.month,
      amount: Math.round(item.planerEarning),
    })),
    vendorEarningOverview: earningOverview.map((item) => ({
      month: item.month,
      amount: Math.round(item.vendorEarning),
    })),
    totalEarningOverview: earningOverview.map((item) => ({
      month: item.month,
      amount: Math.round(item.totalEarning),
    })),
  }

  // 6. subscription earning overview (monthly for subscription payments)
  const subscriptionEarningOverview = await subscriptionEarning(
    selectedSubscriptionYear,
  )

  // 7. bookingOverview (percentage of orders by status)
  const bookingOverviewResult = await Order.aggregate([
    {
      $match: {
        isDeleted: false,
        createdAt: {
          $gte: new Date(`${selectedBookingYear}-01-01`),
          $lt: new Date(`${selectedBookingYear + 1}-01-01`),
        },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$count' },
        statusBreakdown: { $push: { status: '$_id', count: '$count' } },
      },
    },
    {
      $unwind: '$statusBreakdown',
    },
    {
      $project: {
        status: '$statusBreakdown.status',
        percentage: {
          $multiply: [{ $divide: ['$statusBreakdown.count', '$total'] }, 100],
        },
      },
    },
    { $sort: { percentage: -1 } },
  ])

  const bookingOverview = bookingOverviewResult.reduce((acc, curr) => {
    acc[curr.status] = Math.round(curr.percentage)
    return acc
  }, {})

  return {
    totalUserCount,
    avgBookingValue,
    activeSubscriptionCount,
    totalEarning,
    earningOverview: earningOverviewData,
    subscriptionEarningOverview,
    bookingOverview,
  }
}

const planerAnalysisRevenue = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const { event_year, category_year, revenue_year } = query

  const selectedEventYear = event_year
    ? parseInt(event_year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  const selectedCategoryYear = category_year
    ? parseInt(category_year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  const selectedRevenueYear = revenue_year
    ? parseInt(revenue_year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  const metaData = await planerCommonMeta(userId)
  // 1. eventManagedOverview → Monthly count of events managed by planner
  const eventManagedOverview = await authorOrderCountOverview(selectedEventYear, userId);

  // 2. vendorCategoryOverview → Percentage of order types (vendor side)
  const vendorOrderOverview = await vendorOrderResult(selectedCategoryYear, userId)

  const vendorCategoryOverview = vendorOrderOverview.map(item => ({
    type: item.type,
    percentage: Math.round(item.percentage),
  }));

  // 3. revenueGrowthOverview → Monthly authorEarning breakdown
  const revenueGrowth = await revenueGrowthOverview(selectedRevenueYear, userId)

  return {
    eventManaged: metaData.eventManaged,
    activeClient: metaData.activeClient,
    vendorPartnership: metaData.vendorPartnership,
    totalEarning: metaData.totalEarning,
    review: metaData.review,
    eventManagedOverview,
    vendorCategoryOverview,
    revenueGrowthOverview: revenueGrowth,
  };
}

const planerAnalysisEventType = async (userId: string) => {
  const metaData = await planerCommonMeta(userId)

  return {
    eventManaged: metaData.eventManaged,
    activeClient: metaData.activeClient,
    vendorPartnership: metaData.vendorPartnership,
    totalEarning: metaData.totalEarning,
    review: metaData.review
  };
}

const planerAnalysisTopVendor = async (userId: string) => {
  const metaData = await planerCommonMeta(userId)

  return {
    eventManaged: metaData.eventManaged,
    activeClient: metaData.activeClient,
    vendorPartnership: metaData.vendorPartnership,
    totalEarning: metaData.totalEarning,
    review: metaData.review
  };
}

const vendorAnalysisData = async (userId: string) => {
  const user = await User.findById(userId)
  if (!user || user?.isDeleted || user.role !== USER_ROLE.vendor) {
    throw new AppError(httpStatus.NOT_FOUND, 'Vendor not found!')
  }
}

export const AnalysisService = {
  adminAnalysisData,
  planerAnalysisRevenue,
  planerAnalysisEventType,
  planerAnalysisTopVendor,
  vendorAnalysisData,
}
