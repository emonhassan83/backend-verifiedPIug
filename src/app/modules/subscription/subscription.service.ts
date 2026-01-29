import mongoose from 'mongoose'
import cron from 'node-cron'
import httpStatus from 'http-status'
import QueryBuilder from '../../builder/QueryBuilder'
import { TSubscriptions } from './subscription.interface'
import { Package } from '../package/package.model'
import AppError from '../../errors/AppError'
import { User } from '../user/user.model'
import { subscriptionNotifyToUser } from './subscription.utils'
import { Subscription } from './subscription.models'
import { PAYMENT_STATUS } from './subscription.constants'

export const startSubscriptionCron = () => {
  cron.schedule('0 */12 * * *', async () => {
    console.log('⏰ Running subscription check every 12 hours...')

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date()
    tomorrow.setHours(23, 59, 59, 999)

    try {
      // 1. Notify about expiring today
      const expiringToday = await Subscription.find({
        expiredAt: { $gte: today, $lte: tomorrow },
        isExpired: false,
        paymentStatus: PAYMENT_STATUS.paid,
      })

      for (const subscription of expiringToday) {
        const packageData = await Package.findById(subscription.package)
        if (packageData) {
          await subscriptionNotifyToUser(
            'WARNING',
            packageData,
            subscription,
            subscription.user,
          )
        }
      }

      // 2. Mark as expired
      const alreadyExpired = await Subscription.find({
        expiredAt: { $lt: today },
        isExpired: false,
        paymentStatus: PAYMENT_STATUS.paid,
      })

      for (const subscription of alreadyExpired) {
        subscription.isExpired = true
        subscription.isDeleted = true
        await subscription.save()
      }

      console.log(
        `✅ Subscription check done: ${expiringToday.length} warnings, ${alreadyExpired.length} marked expired.`,
      )
    } catch (error) {
      console.error('❌ Subscription cron job error:', error)
    }
  })
}

const createSubscription = async (payload: TSubscriptions) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // Check if an unpaid subscription already exists for the user and package
    const isExist = await Subscription.findOne({
      user: payload.user,
      package: payload.package,
      paymentStatus: PAYMENT_STATUS.unpaid,
      status: 'pending',
    }).session(session)

    if (isExist) {
      return isExist
    }

    // Find the user in the database
    const user = await User.findById(payload.user).session(session)
    if (!user || user.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
    }

    // Find the package in the database
    const packages = await Package.findById(payload.package).session(session)
    if (!packages || packages.isDeleted) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Package not found')
    }

    // Not a valid verified student
    payload.amount = packages.price

    // Determine the expiration date based on billing cycle
    let expiredAt
    const now = new Date()

    if (packages.billingCycle === 'annually') {
      expiredAt = new Date(now.getTime())
      expiredAt.setFullYear(expiredAt.getFullYear() + 1) // Adds 1 year
    } else if (packages.billingCycle === 'monthly') {
      expiredAt = new Date(now.getTime())
      expiredAt.setMonth(expiredAt.getMonth() + 1) // Adds 1 month
    } else {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid billing cycle!')
    }

    payload.expiredAt = expiredAt

    // If the user's existing package expiry is still valid, extend it
    let finalExpiryDate = expiredAt
    if (user.packageExpiry && new Date(user.packageExpiry) > now) {
      finalExpiryDate = new Date(
        new Date(user.packageExpiry).getTime() +
          (expiredAt.getTime() - now.getTime()),
      )
    } else {
      finalExpiryDate = expiredAt
    }

    // Create a new subscription record in the database
    const result = await Subscription.create([payload], { session })
    if (!result || result.length === 0) {
      throw new Error('Failed to create subscription')
    }

    // Commit the transaction if everything is successful
    await session.commitTransaction()
    session.endSession()

    return result[0]
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    throw error
  }
}

const getAllSubscription = async (query: Record<string, any>) => {
  const subscriptionsModel = new QueryBuilder(
    Subscription.find({ isDeleted: false, isExpired: false }).populate([
      {
        path: 'package',
        select: '',
      },
      {
        path: 'user',
        select: 'name email photoUrl contactNumber',
      },
    ]),
    query,
  )
    .search([])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await subscriptionsModel.modelQuery
  const meta = await subscriptionsModel.countTotal()
  return {
    data,
    meta,
  }
}

const getSubscriptionById = async (id: string) => {
  const result = await Subscription.findById(id).populate([
    {
      path: 'package',
      select: '',
    },
    {
      path: 'user',
      select: 'name email photoUrl contactNumber',
    },
  ])
  if (!result || result?.isDeleted) {
    throw new Error('Subscription not found')
  }

  return result
}

const updateSubscription = async (
  id: string,
  payload: Partial<TSubscriptions>,
) => {
  const subscription = await Subscription.findById(id)
  if (!subscription || subscription?.isDeleted) {
    throw new Error('Failed to update subscription')
  }

  const result = await Subscription.findByIdAndUpdate(id, payload, {
    new: true,
  })
  if (!result) {
    throw new Error('Failed to update subscription')
  }

  return result
}

const deleteSubscription = async (id: string) => {
  const subscription = await Subscription.findById(id)
  if (!subscription || subscription?.isDeleted) {
    throw new Error('Failed to update subscription')
  }

  const result = await Subscription.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true },
  )
  if (!result) {
    throw new Error('Failed to delete subscription')
  }

  return result
}

export const subscriptionService = {
  createSubscription,
  getAllSubscription,
  getSubscriptionById,
  updateSubscription,
  deleteSubscription,
}
