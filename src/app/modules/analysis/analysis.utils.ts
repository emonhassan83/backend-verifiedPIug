import { ORDER_AUTHORITY, ORDER_STATUS } from '../order/order.constants'
import { Order } from '../order/order.models'
import { PAYMENT_STATUS } from '../payment/payment.constant'
import { PAYMENT_MODEL_TYPE } from '../payment/payment.interface'
import { Payment } from '../payment/payment.model'

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
