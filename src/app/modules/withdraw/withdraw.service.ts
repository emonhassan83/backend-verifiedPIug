import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { Withdraw } from './withdraw.model'
import { User } from '../user/user.model'
import { PaystackRecipient } from '../paystackRecipient/paystackRecipient.model'
import mongoose, { startSession, Types } from 'mongoose'
import {
  TWithdrawMethod,
  TWithdrawStatus,
  WITHDRAW_METHOD,
  WITHDRAW_STATUS,
} from './withdraw.constant'
import { Payment } from '../payment/payment.model'
import { PAYMENT_STATUS } from '../payment/payment.constant'
import { sendWithdrawNotify } from './withdraw.utils'
import { sendWithdrawStatusChangeEmail } from '../../utils/emailNotify'
import dayjs from 'dayjs'

// 1. Send withdraw request
const createWithdrawIntoDB = async (payload: {
  user: Types.ObjectId
  method: TWithdrawMethod
  amount: number
  note?: string
}) => {
  const session = await startSession()
  session.startTransaction()

  try {
    // Find user
    const user = await User.findById(payload.user).session(session)
    if (!user || user.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
    }

    // withdraw payout rules
    if (payload.amount < 1000 || payload.amount % 100 !== 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Withdrawal amount must be ₦1,000 or more and in multiples of ₦100',
      )
    }

    // Find default account
    const defaultRecipient = await PaystackRecipient.findOne({
      user: payload.user,
      isDefault: true,
      isDeleted: false,
      status: 'verified',
    }).session(session)

    if (!defaultRecipient) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'No verified default Paystack recipient account found. Please connect and verify your bank account.',
      )
    }

    // Limit withdraw request
    const recentWithdraws = await Withdraw.countDocuments({
      user: payload.user,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // গত ২৪ ঘণ্টা
      isDeleted: false,
    }).session(session)

    if (recentWithdraws >= 3) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You have reached the daily withdrawal request limit.',
      )
    }

    // Check Previous pending request
    const pendingWithdraw = await Withdraw.findOne({
      user: payload.user,
      status: WITHDRAW_STATUS.proceed,
      isDeleted: false,
    }).session(session)

    if (pendingWithdraw) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You already have a pending withdrawal request. Please wait until it is processed by admin.',
      )
    }

    // Check Balance
    if (user.balance < payload.amount) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Insufficient balance for withdrawal!',
      )
    }

    // New Record added
    const withdraw = await Withdraw.create(
      [
        {
          user: payload.user,
          authority: user.role,
          amount: payload.amount,
          method: WITHDRAW_METHOD.playstack,
          status: WITHDRAW_STATUS.proceed,
          recipientCode: defaultRecipient.recipientCode,
          note: payload.note || 'Withdrawal request',
        },
      ],
      { session },
    )

    // // Notify all admins about new request
    // await sendWithdrawalRequestNotify(withdraw[0], user)

    await session.commitTransaction()
    return withdraw[0]
  } catch (error: any) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

// 2. Find admin for queries
const getAllWithdrawsFromDB = async (query: Record<string, unknown>) => {
  // 1. totalRevenue: Sum of all paid amounts
  const totalRevenueResult = await Payment.aggregate([
    {
      $match: {
        status: PAYMENT_STATUS.paid,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
      },
    },
  ])
  const totalRevenue = totalRevenueResult[0]?.totalRevenue || 0

  // 2. commission: Sum of all platformEarning from paid payments
  const commissionResult = await Payment.aggregate([
    {
      $match: {
        status: PAYMENT_STATUS.paid,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        commission: { $sum: '$platformEarning' },
      },
    },
  ])
  const commission = commissionResult[0]?.commission || 0

  // 3. pendingPayout: Sum of all pending withdrawal amounts
  const pendingPayoutResult = await Withdraw.aggregate([
    {
      $match: {
        status: WITHDRAW_STATUS.proceed,
      },
    },
    {
      $group: {
        _id: null,
        pendingPayout: { $sum: '$amount' },
      },
    },
  ])
  const pendingPayout = pendingPayoutResult[0]?.pendingPayout || 0

  const withdrawQuery = new QueryBuilder(
    Withdraw.find().populate([{ path: 'user', select: 'name email photoUrl' }, { path: 'order', select: 'title' }]),
    query,
  )
    .search([])
    .filter()
    .sort()
    .paginate()
    .fields()

  const result = await withdrawQuery.modelQuery
  const meta = await withdrawQuery.countTotal()

  return {
    meta,
    data: {
      totalRevenue,
      commission,
      pendingPayout,
      withdrawList: result,
    },
  }
}

const getMyWithdrawsFromDB = async (query: Record<string, unknown>, userId: string) => {
  // 🔹 1. totalWithdraw (completed only)
  const totalWithdrawResult = await Withdraw.aggregate([
    {
      $match: {
        user: new Types.ObjectId(userId),
        status: WITHDRAW_STATUS.completed,
      },
    },
    {
      $group: {
        _id: null,
        totalWithdraw: { $sum: '$amount' },
      },
    },
  ])

  const totalWithdraw = totalWithdrawResult[0]?.totalWithdraw || 0

  // 🔹 2. withdraw list with query builder
  const withdrawQuery = new QueryBuilder(
    Withdraw.find().populate([
      { path: 'user', select: 'name email photoUrl' },
      { path: 'order', select: 'title' },
    ]),
    query,
  )
    .search([])
    .filter()
    .sort()
    .paginate()
    .fields()

  const withdrawList = await withdrawQuery.modelQuery
  const meta = await withdrawQuery.countTotal()

  // 🔹 3. final response format
  return {
    meta,
    data: {
      totalWithdraw,
      withdrawList,
    },
  }
}

// 3. For a withdraw request
const getAWithdrawFromDB = async (id: string) => {
  const result = await Withdraw.findById(id).populate([
    { path: 'user', select: 'name email contractNumber photoUrl balance' },
    {
      path: 'order',
      populate: [
        { path: 'sender', select: 'name email contractNumber photoUrl' },
        { path: 'receiver', select: 'name email contractNumber photoUrl' },
      ],
    },
  ])

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Withdraw request not found')
  }

  return result
}

// 4. Admin withdraw request update
const updateWithdrawFromDB = async (
  id: string,
  payload: { status: TWithdrawStatus; note?: string },
) => {
  const { status, note } = payload

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const withdraw = await Withdraw.findById(id).session(session)
    if (!withdraw) {
      throw new AppError(httpStatus.NOT_FOUND, 'Withdraw not found')
    }

    const currentStatus = withdraw.status

    // Validate allowed status transitions
    if (currentStatus === WITHDRAW_STATUS.completed) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Completed withdrawals cannot be updated',
      )
    }

    // Case 1: pending → hold → clear proceedAt
    if (
      currentStatus === WITHDRAW_STATUS.pending &&
      status === WITHDRAW_STATUS.hold
    ) {
      withdraw.proceedAt = undefined
      withdraw.status = WITHDRAW_STATUS.hold
    }

    // Case 2: hold → pending → set proceedAt = now + 3 days
    else if (
      currentStatus === WITHDRAW_STATUS.hold &&
      status === WITHDRAW_STATUS.pending
    ) {
      const now = new Date()
      const proceedAtDate = dayjs(now).add(3, 'day').toDate()

      withdraw.proceedAt = proceedAtDate
      withdraw.status = WITHDRAW_STATUS.pending
    }

    // Other status changes (e.g., rejected, etc.) → just update status
    else {
      withdraw.status = status
    }

    await withdraw.save({ session })

    // Send notification to user
    const user = await User.findById(withdraw.user).session(session)
    if (user) {
      await sendWithdrawNotify(status, withdraw, user, note)
    }

    // Send email to user about status change
    if (user) {
      await sendWithdrawStatusChangeEmail(user, withdraw, status)
    }

    // Optional: Log admin action (if you have AuditLog model)
    // await AuditLog.create({ action: 'update_withdraw', adminId, withdrawId: id, oldStatus: currentStatus, newStatus: status, note });

    await session.commitTransaction()

    return withdraw
  } catch (error) {
    await session.abortTransaction()
    throw error instanceof AppError
      ? error
      : new AppError(
          httpStatus.INTERNAL_SERVER_ERROR,
          'Failed to update withdraw status',
        )
  } finally {
    session.endSession()
  }
}

export const WithdrawService = {
  createWithdrawIntoDB,
  getAllWithdrawsFromDB,
  getMyWithdrawsFromDB,
  getAWithdrawFromDB,
  updateWithdrawFromDB,
}
