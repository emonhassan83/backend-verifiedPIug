import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { TWithdraw } from './withdraw.interface'
import { Withdraw } from './withdraw.model'
import { User } from '../user/user.model'
// @ts-ignore
import StripeService from '../../class/stripe/stripe'

const createWithdrawIntoDB = async (payload: TWithdraw) => {
  const { user: userId, amount } = payload

  // 1. Find vendor
  const user = await User.findById(userId).select(
    'balance isDeleted status stripeAccountId email fullname',
  )
  if (!user || user.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')

  // 2. Validate Stripe account
  if (!user.playstackId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Playstack not connected for this user.',
    )
  }

  // 3. Check balance
  if (user.balance < amount) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Insufficient balance for withdrawal!',
    )
  }

  // 4. Attempt transfer via Stripe
  let stripeTransfer: any
  try {
    stripeTransfer = await StripeService.transfer(
      Math.round(amount), // in cents if you're using USD
      user.playstackId,
    )
  } catch (error: any) {
    console.error('❌ Stripe Transfer Failed:', error.message)
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to transfer funds to Stripe account.',
    )
  }

  if (!stripeTransfer?.id) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Stripe transfer failed. Try again later.',
    )
  }

  // 5. Deduct balance from user
  await User.findByIdAndUpdate(userId, {
    $inc: { balance: -amount },
  })

  // 6. Store withdrawal record
  const withdraw = await Withdraw.create({
    vendor: userId,
    amount,
    stripeTransferId: stripeTransfer.id,
  })

  return withdraw
}

const getAllWithdrawsFromDB = async (query: Record<string, unknown>) => {
  const WithdrawQuery = new QueryBuilder(
    Withdraw.find().populate([
      { path: 'vendor', select: 'fullname email photoUrl' },
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
  if (!WithdrawQuery) {
    throw new AppError(httpStatus.NOT_FOUND, 'Withdraw not found!')
  }

  return {
    meta,
    result,
  }
}

const getAWithdrawFromDB = async (id: string) => {
  const result = await Withdraw.findById(id).populate([
    { path: 'vendor', select: 'fullname email photoUrl' },
  ])
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Withdraw not found')
  }

  return result
}

const updateWithdrawFromDB = async (
  id: string,
  payload: Partial<TWithdraw>,
) => {
  const withdraw = await Withdraw.findById(id)
  if (!withdraw) {
    throw new AppError(httpStatus.NOT_FOUND, 'Withdraw not found')
  }

  const updateWithdraw = await Withdraw.findByIdAndUpdate(id, payload, {
    new: true,
  })
  if (!updateWithdraw) {
    throw new AppError(httpStatus.NOT_FOUND, 'Withdraw not updated')
  }

  return updateWithdraw
}

const deleteAWithdrawFromDB = async (id: string) => {
  const withdraw = await Withdraw.findById(id)
  if (!withdraw) {
    throw new AppError(httpStatus.NOT_FOUND, 'Withdraw not found')
  }

  const result = await Withdraw.findByIdAndDelete(id)
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Withdraw Delete failed')
  }

  return result
}

export const WithdrawService = {
  createWithdrawIntoDB,
  getAllWithdrawsFromDB,
  getAWithdrawFromDB,
  updateWithdrawFromDB,
  deleteAWithdrawFromDB,
}
