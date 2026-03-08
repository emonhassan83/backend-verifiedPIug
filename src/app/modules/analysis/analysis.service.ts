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
import mongoose from 'mongoose'
import { ORDER_AUTHORITY, ORDER_STATUS } from '../order/order.constants'
import { Reviews } from '../review/review.models'
import { checkSubscriptionPermission } from '../../utils/subscription.utils'

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

  // 1. Total active users
  const totalUserCount = await User.countDocuments({
    role: USER_ROLE.user,
    status: USER_STATUS.active,
    isDeleted: false,
  })

  // 2. Average booking value (from paid orders)
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

  // 3. Active subscription count
  const activeSubscriptionCount = await Subscription.countDocuments({
    status: SUBSCRIPTION_STATUS.active,
    isDeleted: false,
  })

  // 4. Total earning (all paid payments)
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

  // 5. Unified earning overview (single array with planner, vendor, and total per month)
  const earningOverviewRaw = await getEarningOverview(selectedOrderYear)

  // Transform into single array of objects
  const earningOverview = earningOverviewRaw.map((item) => ({
    month: item.month,
    planner: Math.round(item.planerEarning),
    vendor: Math.round(item.vendorEarning),
    total: Math.round(item.totalEarning),
  }))

  // 6. Subscription earning overview (monthly)
  const subscriptionEarningOverview = await subscriptionEarning(
    selectedSubscriptionYear,
  )

  // 7. Booking overview (percentage by status)
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
    { $unwind: '$statusBreakdown' },
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
    earningOverview, // ← Now a single array with planner, vendor, total
    subscriptionEarningOverview,
    bookingOverview,
  }
}

const planerAnalysisRevenue = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const user = await User.findById(userId)
  if (!user || user?.isDeleted || user.role !== USER_ROLE.planer) {
    throw new AppError(httpStatus.NOT_FOUND, 'Planner not found!')
  }

  // Subscription check: only Pro or Elite can access analysis data
  const { level } = await checkSubscriptionPermission(
    userId,
    'analyticsDashboard',
  )
  if (level === 'starter') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Analysis are only available in Pro or Elite plans. Please upgrade your subscription.',
    )
  }

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
  const eventManagedOverview = await authorOrderCountOverview(
    selectedEventYear,
    userId,
  )

  // 2. vendorCategoryOverview → Percentage of order types (vendor side)
  const vendorOrderOverview = await vendorOrderResult(
    selectedCategoryYear,
    userId,
  )

  const vendorCategoryOverview = vendorOrderOverview.map((item) => ({
    type: item.type,
    percentage: Math.round(item.percentage),
  }))

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
  }
}

const planerAnalysisEventType = async (userId: string) => {
  const user = await User.findById(userId)
  if (!user || user?.isDeleted || user.role !== USER_ROLE.planer) {
    throw new AppError(httpStatus.NOT_FOUND, 'Planner not found!')
  }

  // Subscription check: only Pro or Elite can access analysis data
  const { level } = await checkSubscriptionPermission(
    userId,
    'analyticsDashboard',
  )
  if (level === 'starter') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Analysis is only available in Pro or Elite plans. Please upgrade your subscription.',
    )
  }

  // Get common metadata (eventManaged, activeClient, etc.)
  const metaData = await planerCommonMeta(userId)

  // 1. eventAnalysis → type-wise breakdown of planner's orders (as receiver)
  const eventAnalysisResult = await Order.aggregate([
    {
      $match: {
        authority: ORDER_AUTHORITY.client,
        receiver: new mongoose.Types.ObjectId(userId),
        status: { $nin: [ORDER_STATUS.cancelled, ORDER_STATUS.denied] },
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: '$type', // order type
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$count' },
        types: { $push: { type: '$_id', count: '$count' } },
      },
    },
    { $unwind: '$types' },
    {
      $project: {
        type: '$types.type',
        count: '$types.count',
        percentage: {
          $multiply: [{ $divide: ['$types.count', '$total'] }, 100],
        },
        _id: 0,
      },
    },
    { $sort: { count: -1 } }, // most frequent types first
  ])

  // Format the result (if no orders, return empty array)
  const eventAnalysis = eventAnalysisResult.map((item) => ({
    type: item.type || 'Unknown',
    count: item.count,
    percentage: Math.round(item.percentage || 0),
  }))

  return {
    eventManaged: metaData.eventManaged,
    activeClient: metaData.activeClient,
    vendorPartnership: metaData.vendorPartnership,
    totalEarning: metaData.totalEarning,
    review: metaData.review,
    eventAnalysis,
  }
}

const planerAnalysisTopVendor = async (userId: string) => {
  const user = await User.findById(userId)
  if (!user || user?.isDeleted || user.role !== USER_ROLE.planer) {
    throw new AppError(httpStatus.NOT_FOUND, 'Planner not found!')
  }

  // Subscription check: only Pro or Elite can access analysis data
  const { level } = await checkSubscriptionPermission(
    userId,
    'analyticsDashboard',
  )
  if (level === 'starter') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Analysis is only available in Pro or Elite plans. Please upgrade your subscription.',
    )
  }

  const metaData = await planerCommonMeta(userId)

  // We are finding planners (receiver) where this vendor (sender) placed orders
  const topVendorsResult = await Order.aggregate([
    {
      $match: {
        receiver: new mongoose.Types.ObjectId(userId),
        authority: ORDER_AUTHORITY.vendor,
        status: { $nin: [ORDER_STATUS.cancelled, ORDER_STATUS.denied] },
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: '$sender', // vendor ID
        orderCount: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'vendor',
      },
    },
    { $unwind: '$vendor' },
    {
      $project: {
        name: '$vendor.name',
        orderCount: 1,
        avgRating: '$vendor.avgRating',
        _id: 0,
      },
    },
    { $sort: { orderCount: -1 } }, // highest order count first
    { $limit: 5 }, // top 5 vendors
  ])

  // Format the result (if no data, return empty array)
  const topVendors = topVendorsResult.map((item) => ({
    name: item.name || 'Unknown',
    orderCount: item.orderCount,
    avgRating: item.avgRating || 0,
  }))

  return {
    eventManaged: metaData.eventManaged,
    activeClient: metaData.activeClient,
    vendorPartnership: metaData.vendorPartnership,
    totalEarning: metaData.totalEarning,
    review: metaData.review,
    topVendors,
  }
}

const vendorAnalysisData = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const user = await User.findById(userId);
  if (!user || user?.isDeleted || user.role !== USER_ROLE.vendor) {
    throw new AppError(httpStatus.NOT_FOUND, 'Vendor not found!');
  }

  // Subscription check: only Pro or Elite can access analysis data
  const { level } = await checkSubscriptionPermission(userId, 'analyticsDashboard');
  if (level === 'starter') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Analysis is only available in Pro or Elite plans. Please upgrade your subscription.'
    );
  }

  const { revenue_year, satisfaction_year, service_year, booking_year } = query

  const totalBookingCount = await Order.countDocuments({
    receiver: userId,
    authority: ORDER_AUTHORITY.vendor,
    status: { $nin: [ORDER_STATUS.cancelled, ORDER_STATUS.denied] },
    isDeleted: false,
  })

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

  // Selected years (default to current year)
  const selectedRevenueYear = revenue_year
    ? parseInt(revenue_year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  const selectedSatisfactionYear = satisfaction_year
    ? parseInt(satisfaction_year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  const selectedServiceYear = service_year
    ? parseInt(service_year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  const selectedBookingYear = booking_year
    ? parseInt(booking_year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  // ──────────────────────────────────────────────
  // 1. monthlyRevenue: Revenue per month (completed orders)
  // ──────────────────────────────────────────────
  const monthlyRevenueAgg = await Order.aggregate([
    {
      $match: {
        sender: new mongoose.Types.ObjectId(userId),
        authority: ORDER_AUTHORITY.vendor,
        status: ORDER_STATUS.completed,
        isDeleted: false,
        actualEndDate: {
          $gte: new Date(`${selectedRevenueYear}-01-01`),
          $lt: new Date(`${selectedRevenueYear + 1}-01-01`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$actualEndDate' },
        amount: { $sum: '$totalAmount' },
      },
    },
    {
      $project: {
        month: '$_id',
        amount: 1,
        _id: 0,
      },
    },
    { $sort: { month: 1 } },
  ])

  // Fill all 12 months with 0 if missing
  const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
    const rawAmount =
      monthlyRevenueAgg.find((m) => m.month === i + 1)?.amount || 0
    const afterCommission = Math.round(rawAmount * 0.97) // 3% commission deducted
    return {
      month: i + 1,
      amount: afterCommission,
    }
  })

  // ──────────────────────────────────────────────
  // 2. clientSatisfaction: Monthly review count
  // ──────────────────────────────────────────────
  const clientSatisfactionAgg = await Reviews.aggregate([
    {
      $match: {
        author: new mongoose.Types.ObjectId(userId),
        createdAt: {
          $gte: new Date(`${selectedSatisfactionYear}-01-01`),
          $lt: new Date(`${selectedSatisfactionYear + 1}-01-01`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        month: '$_id',
        count: 1,
        _id: 0,
      },
    },
    { $sort: { month: 1 } },
  ])

  const clientSatisfaction = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    count: clientSatisfactionAgg.find((m) => m.month === i + 1)?.count || 0,
  }))

  // ──────────────────────────────────────────────
  // 3. servicePopularity: Percentage by order type (all-time)
  // ──────────────────────────────────────────────
  const servicePopularityAgg = await Order.aggregate([
    {
      $match: {
        sender: new mongoose.Types.ObjectId(userId),
        authority: ORDER_AUTHORITY.vendor,
        isDeleted: false,
        createdAt: {
          $gte: new Date(`${selectedServiceYear}-01-01`),
          $lt: new Date(`${selectedServiceYear + 1}-01-01`),
        },
      },
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$count' },
        types: { $push: { type: '$_id', count: '$count' } },
      },
    },
    {
      $project: {
        types: {
          $map: {
            input: '$types',
            as: 't',
            in: {
              type: '$$t.type',
              percentage: {
                $round: [
                  { $multiply: [{ $divide: ['$$t.count', '$total'] }, 100] },
                  2,
                ],
              },
            },
          },
        },
      },
    },
  ])

  const servicePopularity = servicePopularityAgg[0]?.types || []

  // ──────────────────────────────────────────────
  // 4. bookingTrends: Monthly booking count (orders received)
  // ──────────────────────────────────────────────
  const bookingTrendsAgg = await Order.aggregate([
    {
      $match: {
        sender: new mongoose.Types.ObjectId(userId),
        authority: ORDER_AUTHORITY.vendor,
        isDeleted: false,
        createdAt: {
          $gte: new Date(`${selectedBookingYear}-01-01`),
          $lt: new Date(`${selectedBookingYear + 1}-01-01`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        month: '$_id',
        count: 1,
        _id: 0,
      },
    },
    { $sort: { month: 1 } },
  ])

  const bookingTrends = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    count: bookingTrendsAgg.find((m) => m.month === i + 1)?.count || 0,
  }))

  return {
    totalBookingCount,
    totalEarnings: Math.round(totalEarningsAfterCommission),

    monthlyRevenue,
    clientSatisfaction,
    servicePopularity,
    bookingTrends,
  }
}

const planerLeadsData = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const user = await User.findById(userId)
  if (!user || user?.isDeleted || user.role !== USER_ROLE.planer) {
    throw new AppError(httpStatus.NOT_FOUND, 'Planner not found!')
  }

  // Subscription check: only Pro or Elite can access leads data
  const { level } = await checkSubscriptionPermission(userId, 'leadInsights')
  if (level === 'starter') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Leads insights are only available in Pro or Elite plans. Please upgrade your subscription to view detailed lead data.',
    )
  }

  const tab = (query.tab as string)?.toLowerCase() || 'new'
  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 10
  const skip = (page - 1) * limit

  // Correct base condition: planner is the sender (placed the order), authority is client
  const baseMatch = {
    sender: new mongoose.Types.ObjectId(userId), // Planner is the sender
    authority: ORDER_AUTHORITY.client, // Order received from client
    isDeleted: false,
  }

  // ──────────────────────────────────────────────
  // 1. New Leads: First-time clients (unique receivers with exactly 1 order)
  // ──────────────────────────────────────────────
  const newLeadsAgg = await Order.aggregate([
    { $match: { ...baseMatch } },
    {
      $group: {
        _id: '$receiver', // Group by client (receiver)
        orderCount: { $sum: 1 },
        firstOrder: { $min: '$createdAt' },
      },
    },
    { $match: { orderCount: 1 } },
    { $count: 'total' },
  ])

  const newLeadsCount = newLeadsAgg[0]?.total || 0

  // ──────────────────────────────────────────────
  // 2. Contracted: Clients with at least one pending/running/completed order
  // ──────────────────────────────────────────────
  const contractedAgg = await Order.aggregate([
    {
      $match: {
        ...baseMatch,
        status: {
          $in: [
            ORDER_STATUS.pending,
            ORDER_STATUS.running,
            ORDER_STATUS.completed,
          ],
        },
      },
    },
    {
      $group: {
        _id: '$receiver',
      },
    },
    { $count: 'total' },
  ])

  const contractedCount = contractedAgg[0]?.total || 0

  // ──────────────────────────────────────────────
  // 3. Qualified: Clients with at least one running/completed order
  // ──────────────────────────────────────────────
  const qualifiedAgg = await Order.aggregate([
    {
      $match: {
        ...baseMatch,
        status: { $in: [ORDER_STATUS.running, ORDER_STATUS.completed] },
      },
    },
    {
      $group: {
        _id: '$receiver',
      },
    },
    { $count: 'total' },
  ])

  const qualifiedCount = qualifiedAgg[0]?.total || 0

  // ──────────────────────────────────────────────
  // 4. Left: Clients whose ALL orders are cancelled/denied/refunded
  // ──────────────────────────────────────────────
  const leftAgg = await Order.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: '$receiver',
        statuses: { $addToSet: '$status' },
        orderCount: { $sum: 1 },
      },
    },
    {
      $match: {
        $and: [
          {
            statuses: {
              $nin: [
                ORDER_STATUS.pending,
                ORDER_STATUS.running,
                ORDER_STATUS.completed,
              ],
            },
          },
          {
            statuses: {
              $in: [
                ORDER_STATUS.cancelled,
                ORDER_STATUS.denied,
                ORDER_STATUS.refunded,
              ],
            },
          },
        ],
      },
    },
    { $count: 'total' },
  ])

  const leftCount = leftAgg[0]?.total || 0

  // ──────────────────────────────────────────────
  // 5. Lead List — filtered by tab
  // ──────────────────────────────────────────────
  let matchFilter: any = { ...baseMatch }

  switch (tab) {
    case 'new':
      // First-time clients (only 1 order total)
      const firstTimeReceivers = await Order.aggregate([
        { $match: baseMatch },
        { $group: { _id: '$receiver', count: { $sum: 1 } } },
        { $match: { count: 1 } },
        { $project: { _id: 0, receiver: '$_id' } },
      ]).then((r) => r.map((s) => s.receiver))

      matchFilter.receiver = { $in: firstTimeReceivers }
      break

    case 'contacted':
      // Has at least one pending/running/completed
      const contactedReceivers = await Order.distinct('receiver', {
        ...baseMatch,
        status: {
          $in: [
            ORDER_STATUS.pending,
            ORDER_STATUS.running,
            ORDER_STATUS.completed,
          ],
        },
      })
      matchFilter.receiver = { $in: contactedReceivers }
      break

    case 'qualified':
      // Has at least one running/completed
      const qualifiedReceivers = await Order.distinct('receiver', {
        ...baseMatch,
        status: { $in: [ORDER_STATUS.running, ORDER_STATUS.completed] },
      })
      matchFilter.receiver = { $in: qualifiedReceivers }
      break

    case 'cancel':
      // Only cancelled/denied/refunded
      const cancelReceivers = await Order.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: '$receiver',
            hasActive: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$status',
                      [
                        ORDER_STATUS.pending,
                        ORDER_STATUS.running,
                        ORDER_STATUS.completed,
                      ],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $match: { hasActive: 0 } },
        { $project: { _id: 0, receiver: '$_id' } },
      ]).then((r) => r.map((s) => s.receiver))

      matchFilter.receiver = { $in: cancelReceivers }
      break

    default:
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid tab value')
  }

  const leadList = await Order.find(matchFilter)
    .select(
      'title type shortDescription startDate address location locationUrl receiver sender',
    )
    .populate({
      path: 'receiver',
      select: 'name photoUrl',
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean()

  const totalLeads = await Order.countDocuments(matchFilter)

  return {
    meta: {
      page,
      limit,
      total: totalLeads,
      totalPages: Math.ceil(totalLeads / limit),
    },
    data: {
      newLeads: newLeadsCount,
      contracted: contractedCount,
      qualified: qualifiedCount,
      left: leftCount,
      leadList,
    },
  }
}

const vendorLeadsData = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const user = await User.findById(userId)
  if (!user || user?.isDeleted || user.role !== USER_ROLE.vendor) {
    throw new AppError(httpStatus.NOT_FOUND, 'Vendor not found!')
  }

  // Subscription check: only Pro or Elite can access leads data
  const { level } = await checkSubscriptionPermission(userId, 'leadInsights')
  if (level === 'starter') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Leads insights are only available in Pro or Elite plans. Please upgrade your subscription to view detailed lead data.',
    )
  }

  const tab = (query.tab as string)?.toLowerCase() || 'new' // default to 'new'
  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 10
  const skip = (page - 1) * limit

  // Base match: vendor is sender + authority is vendor
  const baseMatch = {
    sender: new mongoose.Types.ObjectId(userId),
    authority: ORDER_AUTHORITY.vendor,
    isDeleted: false,
  }

  // ──────────────────────────────────────────────
  // 1. New Leads: unique receivers (planners) with exactly 1 order (first-time collaboration)
  // ──────────────────────────────────────────────
  const newLeadsAgg = await Order.aggregate([
    { $match: { ...baseMatch } },
    {
      $group: {
        _id: '$receiver',
        orderCount: { $sum: 1 },
        firstOrder: { $min: '$createdAt' },
      },
    },
    { $match: { orderCount: 1 } },
    { $count: 'total' },
  ])

  const newLeadsCount = newLeadsAgg[0]?.total || 0

  // ──────────────────────────────────────────────
  // 2. Contracted: unique planners with at least one pending/running/completed order
  // ──────────────────────────────────────────────
  const contractedAgg = await Order.aggregate([
    {
      $match: {
        ...baseMatch,
        status: {
          $in: [
            ORDER_STATUS.pending,
            ORDER_STATUS.running,
            ORDER_STATUS.completed,
          ],
        },
      },
    },
    {
      $group: {
        _id: '$receiver',
      },
    },
    { $count: 'total' },
  ])

  const contractedCount = contractedAgg[0]?.total || 0

  // ──────────────────────────────────────────────
  // 3. Qualified: unique planners with at least one running/completed order
  // ──────────────────────────────────────────────
  const qualifiedAgg = await Order.aggregate([
    {
      $match: {
        ...baseMatch,
        status: { $in: [ORDER_STATUS.running, ORDER_STATUS.completed] },
      },
    },
    {
      $group: {
        _id: '$receiver',
      },
    },
    { $count: 'total' },
  ])

  const qualifiedCount = qualifiedAgg[0]?.total || 0

  // ──────────────────────────────────────────────
  // 4. Left: unique planners whose ALL orders are cancelled/denied/refunded
  // ──────────────────────────────────────────────
  const leftAgg = await Order.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: '$receiver',
        statuses: { $addToSet: '$status' },
        orderCount: { $sum: 1 },
      },
    },
    {
      $match: {
        $and: [
          {
            statuses: {
              $nin: [
                ORDER_STATUS.pending,
                ORDER_STATUS.running,
                ORDER_STATUS.completed,
              ],
            },
          },
          {
            statuses: {
              $in: [
                ORDER_STATUS.cancelled,
                ORDER_STATUS.denied,
                ORDER_STATUS.refunded,
              ],
            },
          },
        ],
      },
    },
    { $count: 'total' },
  ])

  const leftCount = leftAgg[0]?.total || 0

  // ──────────────────────────────────────────────
  // 5. Lead List — filtered by tab (orders where vendor is sender)
  // ──────────────────────────────────────────────
  let matchFilter: any = { ...baseMatch }

  switch (tab) {
    case 'new':
      // First-time planners (only 1 order total)
      const firstTimeReceivers = await Order.aggregate([
        { $match: baseMatch },
        { $group: { _id: '$receiver', count: { $sum: 1 } } },
        { $match: { count: 1 } },
        { $project: { _id: 0, receiver: '$_id' } },
      ]).then((r) => r.map((s) => s.receiver))

      matchFilter.receiver = { $in: firstTimeReceivers }
      break

    case 'contacted':
      // Has at least one pending/running/completed
      const contactedReceivers = await Order.distinct('receiver', {
        ...baseMatch,
        status: {
          $in: [
            ORDER_STATUS.pending,
            ORDER_STATUS.running,
            ORDER_STATUS.completed,
          ],
        },
      })
      matchFilter.receiver = { $in: contactedReceivers }
      break

    case 'qualified':
      // Has at least one running/completed
      const qualifiedReceivers = await Order.distinct('receiver', {
        ...baseMatch,
        status: { $in: [ORDER_STATUS.running, ORDER_STATUS.completed] },
      })
      matchFilter.receiver = { $in: qualifiedReceivers }
      break

    case 'cancel':
      // Only cancelled/denied/refunded
      const cancelReceivers = await Order.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: '$receiver',
            hasActive: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$status',
                      [
                        ORDER_STATUS.pending,
                        ORDER_STATUS.running,
                        ORDER_STATUS.completed,
                      ],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $match: { hasActive: 0 } },
        { $project: { _id: 0, receiver: '$_id' } },
      ]).then((r) => r.map((s) => s.receiver))

      matchFilter.receiver = { $in: cancelReceivers }
      break

    default:
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid tab value')
  }

  const leadList = await Order.find(matchFilter)
    .select(
      'title type shortDescription startDate address location locationUrl receiver',
    )
    .populate({
      path: 'receiver',
      select: 'name photoUrl',
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean()

  const totalLeads = await Order.countDocuments(matchFilter)

  return {
    meta: {
      page,
      limit,
      total: totalLeads,
      totalPages: Math.ceil(totalLeads / limit),
    },
    data: {
      newLeads: newLeadsCount,
      contracted: contractedCount,
      qualified: qualifiedCount,
      left: leftCount,
      leadList,
    },
  }
}

export const AnalysisService = {
  adminAnalysisData,
  planerAnalysisRevenue,
  planerAnalysisEventType,
  planerAnalysisTopVendor,
  vendorAnalysisData,
  planerLeadsData,
  vendorLeadsData,
}
