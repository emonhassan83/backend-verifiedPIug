import mongoose from 'mongoose'
import httpStatus from 'http-status'
import { ORDER_AUTHORITY, ORDER_STATUS } from '../order/order.constants'
import { Order } from '../order/order.models'
import { PAYMENT_STATUS } from '../payment/payment.constant'
import { PAYMENT_MODEL_TYPE } from '../payment/payment.interface'
import { Payment } from '../payment/payment.model'
import { User } from '../user/user.model'
import { USER_ROLE } from '../user/user.constant'
import AppError from '../../errors/AppError'

export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const fillAllMonths = (data: { month: string; [key: string]: any }[], valueKey: string) => {
  return MONTHS.map(month => {
    const found = data.find(d => d.month.toLowerCase() === month)
    return {
      month,
      [valueKey]: found ? found[valueKey] : 0,
    }
  })
}

const getYearRange = (year: number) => ({
  $gte: new Date(`${year}-01-01`),
  $lt: new Date(`${year + 1}-01-01`),
})

export const getEarningOverview = async (year: number) => {
  return await Order.aggregate([
    {
      $match: {
        status: ORDER_STATUS.completed,
        isDeleted: false,
        actualEndDate: {
          $gte: new Date(`${year}-01-01`),
          $lt: new Date(`${year + 1}-01-01`),
        },
      },
    },
    {
      $group: {
        _id: {
          month: { $month: '$actualEndDate' },
          authority: '$authority',
        },
        totalAmount: { $sum: '$totalAmount' },
      },
    },
    {
      $group: {
        _id: '$_id.month',
        planerEarning: {
          $sum: {
            $cond: [
              { $eq: ['$_id.authority', ORDER_AUTHORITY.client] },
              '$totalAmount',
              0,
            ],
          },
        },
        vendorEarning: {
          $sum: {
            $cond: [
              { $eq: ['$_id.authority', ORDER_AUTHORITY.vendor] },
              '$totalAmount',
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        month: {
          $switch: {
            branches: [
              { case: { $eq: ['$_id', 1] }, then: 'January' },
              { case: { $eq: ['$_id', 2] }, then: 'February' },
              { case: { $eq: ['$_id', 3] }, then: 'March' },
              { case: { $eq: ['$_id', 4] }, then: 'April' },
              { case: { $eq: ['$_id', 5] }, then: 'May' },
              { case: { $eq: ['$_id', 6] }, then: 'June' },
              { case: { $eq: ['$_id', 7] }, then: 'July' },
              { case: { $eq: ['$_id', 8] }, then: 'August' },
              { case: { $eq: ['$_id', 9] }, then: 'September' },
              { case: { $eq: ['$_id', 10] }, then: 'October' },
              { case: { $eq: ['$_id', 11] }, then: 'November' },
              { case: { $eq: ['$_id', 12] }, then: 'December' },
            ],
            default: 'Unknown',
          },
        },
        planerEarning: 1,
        vendorEarning: 1,
        totalEarning: { $add: ['$planerEarning', '$vendorEarning'] },
        _id: 0,
      },
    },
    { $sort: { _id: 1 } }, // month order
  ])
}

export const subscriptionEarning = async (year: number) => {
  return await Payment.aggregate([
    {
      $match: {
        modelType: PAYMENT_MODEL_TYPE.Subscription,
        status: PAYMENT_STATUS.paid,
        isDeleted: false,
        createdAt: {
          $gte: new Date(`${year}-01-01`),
          $lt: new Date(`${year + 1}-01-01`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        amount: { $sum: '$amount' },
      },
    },
    {
      $project: {
        month: {
          $switch: {
            branches: [
              { case: { $eq: ['$_id', 1] }, then: 'January' },
              { case: { $eq: ['$_id', 2] }, then: 'February' },
              { case: { $eq: ['$_id', 3] }, then: 'March' },
              { case: { $eq: ['$_id', 4] }, then: 'April' },
              { case: { $eq: ['$_id', 5] }, then: 'May' },
              { case: { $eq: ['$_id', 6] }, then: 'June' },
              { case: { $eq: ['$_id', 7] }, then: 'July' },
              { case: { $eq: ['$_id', 8] }, then: 'August' },
              { case: { $eq: ['$_id', 9] }, then: 'September' },
              { case: { $eq: ['$_id', 10] }, then: 'October' },
              { case: { $eq: ['$_id', 11] }, then: 'November' },
              { case: { $eq: ['$_id', 12] }, then: 'December' },
            ],
            default: 'Unknown',
          },
        },
        amount: 1,
        _id: 0,
      },
    },
    { $sort: { _id: 1 } },
  ])
}

export const bookingOverview = async (year: number) => {
  return await Order.aggregate([
    {
      $match: {
        isDeleted: false,
        createdAt: {
          $gte: new Date(`${year}-01-01`),
          $lt: new Date(`${year + 1}-01-01`),
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
}

export const planerCommonMeta = async (userId: string) => {
  const user = await User.findById(userId)
  if (!user || user?.isDeleted || user.role !== USER_ROLE.planer) {
    throw new AppError(httpStatus.NOT_FOUND, 'Planer not found!')
  }

  // 1. eventManaged in planer
  const eventManaged = await Order.countDocuments({
    sender: userId,
    authority: ORDER_AUTHORITY.client,
    status: { $nin: [ORDER_STATUS.cancelled, ORDER_STATUS.denied] },
    isDeleted: false,
  })

  // 2. activeClient
  const activeClientResult = await Order.aggregate([
    {
      $match: {
        sender: new mongoose.Types.ObjectId(userId),
        authority: ORDER_AUTHORITY.client,
        status: { $nin: [ORDER_STATUS.cancelled, ORDER_STATUS.denied] },
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: '$receiver',
      },
    },
    {
      $count: 'activeClients',
    },
  ])
  const activeClient = activeClientResult[0]?.activeClients || 0

  // 3. vendorPartnership count
  const vendorPartnershipResult = await Order.aggregate([
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
      },
    },
    {
      $count: 'vendorPartnerships',
    },
  ])
  const vendorPartnership = vendorPartnershipResult[0]?.vendorPartnerships || 0

  // 4. totalEarning → authorEarning from paid payments
  const totalEarningResult = await Payment.aggregate([
    {
      $match: {
        author: new mongoose.Types.ObjectId(userId),
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
  ])
  const totalEarning = totalEarningResult[0]?.total || 0

  // 5. review data (avgRating + ratingCount from user model)
  const review = {
    avgRating: user.avgRating || 0,
    ratingCount: user.ratingCount || 0,
  }

  return {
    eventManaged,
    activeClient,
    vendorPartnership,
    totalEarning,
    review,
  }
}

export const authorOrderCountOverview = async (year: number, userId: string) => {
  const result = await Order.aggregate([
    {
      $match: {
        sender: new mongoose.Types.ObjectId(userId),
        authority: ORDER_AUTHORITY.client,
        status: { $nin: [ORDER_STATUS.cancelled, ORDER_STATUS.denied] },
        isDeleted: false,
        createdAt: getYearRange(year),
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
        month: {
          $switch: {
            branches: [
              { case: { $eq: ['$_id', 1] }, then: 'Jan' },
              { case: { $eq: ['$_id', 2] }, then: 'Feb' },
              { case: { $eq: ['$_id', 3] }, then: 'Mar' },
              { case: { $eq: ['$_id', 4] }, then: 'Apr' },
              { case: { $eq: ['$_id', 5] }, then: 'May' },
              { case: { $eq: ['$_id', 6] }, then: 'Jun' },
              { case: { $eq: ['$_id', 7] }, then: 'Jul' },
              { case: { $eq: ['$_id', 8] }, then: 'Aug' },
              { case: { $eq: ['$_id', 9] }, then: 'Sep' },
              { case: { $eq: ['$_id', 10] }, then: 'Oct' },
              { case: { $eq: ['$_id', 11] }, then: 'Nov' },
              { case: { $eq: ['$_id', 12] }, then: 'Dec' },
            ],
            default: 'Unknown',
          },
        },
        count: 1,
        _id: 0,
      },
    },
    { $sort: { _id: 1 } },
  ])

  return fillAllMonths(result, 'count')
}

export const vendorOrderResult = async (year: number, userId: string) => {
  return await Order.aggregate([
    {
      $match: {
        receiver: new mongoose.Types.ObjectId(userId),
        authority: ORDER_AUTHORITY.vendor,
        status: { $nin: [ORDER_STATUS.cancelled, ORDER_STATUS.denied] },
        isDeleted: false,
        createdAt: getYearRange(year),
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
        categories: { $push: { type: '$_id', count: '$count' } },
      },
    },
    { $unwind: '$categories' },
    {
      $project: {
        type: '$categories.type',
        percentage: {
          $multiply: [{ $divide: ['$categories.count', '$total'] }, 100],
        },
        _id: 0,
      },
    },
    { $sort: { percentage: -1 } },
  ])
}

export const revenueGrowthOverview = async (year: number, userId: string) => {
  const result = await Payment.aggregate([
    {
      $match: {
        author: new mongoose.Types.ObjectId(userId),
        status: PAYMENT_STATUS.paid,
        isPaid: true,
        isDeleted: false,
        createdAt: getYearRange(year),
      },
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        amount: { $sum: '$authorEarning' },
      },
    },
    {
      $project: {
        month: {
          $switch: {
            branches: [
              { case: { $eq: ['$_id', 1] }, then: 'Jan' },
              { case: { $eq: ['$_id', 2] }, then: 'Feb' },
              { case: { $eq: ['$_id', 3] }, then: 'Mar' },
              { case: { $eq: ['$_id', 4] }, then: 'Apr' },
              { case: { $eq: ['$_id', 5] }, then: 'May' },
              { case: { $eq: ['$_id', 6] }, then: 'Jun' },
              { case: { $eq: ['$_id', 7] }, then: 'Jul' },
              { case: { $eq: ['$_id', 8] }, then: 'Aug' },
              { case: { $eq: ['$_id', 9] }, then: 'Sep' },
              { case: { $eq: ['$_id', 10] }, then: 'Oct' },
              { case: { $eq: ['$_id', 11] }, then: 'Nov' },
              { case: { $eq: ['$_id', 12] }, then: 'Dec' },
            ],
            default: 'Unknown',
          },
        },
        amount: 1,
        _id: 0,
      },
    },
    { $sort: { _id: 1 } },
  ])

  return fillAllMonths(result, 'amount')
}
