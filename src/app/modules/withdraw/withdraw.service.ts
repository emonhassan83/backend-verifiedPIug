import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { TWithdraw } from './withdraw.interface'
import { Withdraw } from './withdraw.model'
import { User } from '../user/user.model'
import { PaystackRecipient } from '../paystackRecipient/paystackRecipient.model'
import { startSession } from 'mongoose'
import axios from 'axios'
import config from '../../config'
import { WITHDRAW_METHOD, WITHDRAW_STATUS } from './withdraw.constant'
import {
  sendWithdrawalRequestNotify,
  sendWithdrawalStatusNotify,
} from './withdraw.utils'

const createWithdrawIntoDB = async (payload: TWithdraw) => {
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
      status: WITHDRAW_STATUS.pending,
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
          amount: payload.amount,
          method: WITHDRAW_METHOD.playstack,
          status: WITHDRAW_STATUS.pending,
          recipientCode: defaultRecipient.recipientCode,
          note: payload.note || 'Withdrawal request',
        },
      ],
      { session },
    )

    // Notify all admins about new request
    await sendWithdrawalRequestNotify(withdraw[0], user)

    await session.commitTransaction()
    return withdraw[0]
  } catch (error: any) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

// ২. Find admin for queries
const getAllWithdrawsFromDB = async (query: Record<string, unknown>) => {
  const WithdrawQuery = new QueryBuilder(
    Withdraw.find().populate([
      { path: 'user', select: 'name email photoUrl balance' },
    ]),
    query,
  )
    .search([])
    .filter()
    .sort()
    .paginate()
    .fields()

  const result = await WithdrawQuery.modelQuery
  const meta = await WithdrawQuery.countTotal()

  return { meta, result }
}

// ৩. For a withdraw request
const getAWithdrawFromDB = async (id: string) => {
  const result = await Withdraw.findById(id).populate([
    { path: 'user', select: 'name email photoUrl balance' },
  ])

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Withdraw request not found')
  }

  return result
}

// ৪. Admin withdraw request update
const updateWithdrawFromDB = async (
  id: string,
  payload: Partial<TWithdraw> & { processedBy: string },
) => {
  const { status } = payload
  const session = await startSession()
  session.startTransaction()

  try {
    const withdraw = await Withdraw.findById(id).session(session)
    if (!withdraw) {
      throw new AppError(httpStatus.NOT_FOUND, 'Withdraw request not found')
    }

    const user = await User.findById(withdraw.user).session(session)
    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found')
    }

    // check request
    if (withdraw.status !== WITHDRAW_STATUS.pending) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Cannot update. Request is already ${withdraw.status}`,
      )
    }

    // IF Status approved then Paystack transfer
    if (payload.status === WITHDRAW_STATUS.approved) {
      if (user.balance < withdraw.amount) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'User has insufficient balance now',
        )
      }
      // Paystack- transfar
      const transferResponse = await axios.post(
        'https://api.paystack.co/transfer',
        {
          source: 'balance',
          amount: withdraw.amount * 100, // kobo
          recipient: withdraw.recipientCode,
          reason: payload.note || `Approved withdrawal for user ${user._id}`,
        },
        {
          headers: {
            Authorization: `Bearer ${config.paystack.secret_key}`,
            'Content-Type': 'application/json',
          },
        },
      )

      if (!transferResponse.data.status) {
        throw new AppError(
          httpStatus.INTERNAL_SERVER_ERROR,
          'Paystack transfer failed',
        )
      }

      const transferData = transferResponse.data.data

      // User balance reduce
      await User.findByIdAndUpdate(
        withdraw.user,
        {
          $inc: { balance: -withdraw.amount },
        },
        { session },
      )

      // Withdraw update
      await Withdraw.findByIdAndUpdate(
        id,
        {
          status: WITHDRAW_STATUS.paid,
          paystackTransferId: transferData.id,
          processedBy: payload.processedBy,
          note: payload.note,
        },
        { session, new: true },
      )
    }

    // Others status updated
    const updatedWithdraw = await Withdraw.findByIdAndUpdate(
      id,
      {
        status: payload.status,
        processedBy: payload.processedBy,
        note: payload.note,
        processedAt: new Date(),
      },
      { session, new: true },
    )

    // Notify user: payment sent
    await sendWithdrawalStatusNotify(updatedWithdraw, user, status!)

    await session.commitTransaction()
    return updatedWithdraw
  } catch (error: any) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

// ৫. Deleted functionality but not recommended
const deleteAWithdrawFromDB = async (id: string) => {
  const withdraw = await Withdraw.findById(id)
  if (!withdraw) {
    throw new AppError(httpStatus.NOT_FOUND, 'Withdraw not found')
  }

  if (withdraw.status !== WITHDRAW_STATUS.pending) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Cannot delete a processed withdrawal',
    )
  }

  await Withdraw.findByIdAndDelete(id)
  return { success: true, message: 'Withdraw request deleted' }
}

export const WithdrawService = {
  createWithdrawIntoDB,
  getAllWithdrawsFromDB,
  getAWithdrawFromDB,
  updateWithdrawFromDB,
  deleteAWithdrawFromDB,
}
