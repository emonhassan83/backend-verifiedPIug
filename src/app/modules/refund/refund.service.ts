import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { Refund } from './refund.model'
import { User } from '../user/user.model'
import { refundChangeStatusNotifyToUser } from './refund.utils'
import { Order } from '../order/order.models'
import { ORDER_STATUS, PAYMENT_STATUS } from '../order/order.constants'
import { REFUND_STATUS, TRefundStatus } from './refund.constant'
import { startSession } from 'mongoose'
import { Payment } from '../payment/payment.model'
import { PAYMENT_MODEL_TYPE } from '../payment/payment.interface'
import { refundPaystackPayment } from '../payment/payment.utils'
import { Project } from '../project/project.models'
import { PROJECT_STATUS } from '../project/project.constants'

const getAllRefundsFromDB = async (query: Record<string, unknown>) => {
  const refundQuery = new QueryBuilder(
    Refund.find().populate([
      {
        path: 'user',
        select: 'name email photoUrl contractNumber',
      },
      {
        path: 'order',
        select: 'title',
      },
    ]),
    query,
  )
    .search([''])
    .filter()
    .sort()
    .paginate()
    .fields()

  const refunds = await refundQuery.modelQuery
  const meta = await refundQuery.countTotal()

  return {
    meta,
    result: refunds,
  }
}

const getARefundFromDB = async (id: string) => {
  // Step 1: Get the refund with related data
  const refund = await Refund.findById(id).populate([
    {
      path: 'user',
      select: 'name email photoUrl contractNumber',
    },
    {
      path: 'order',
      populate: [
        { path: 'sender', select: 'name email photoUrl contractNumber' },
        { path: 'receiver', select: 'name email photoUrl contractNumber' },
      ],
    },
  ])
  if (!refund) {
    throw new AppError(httpStatus.NOT_FOUND, 'Refund request not found')
  }

  return refund
}

const updateRefundStatusFromDB = async (
  id: string,
  payload: { status: TRefundStatus; note: string },
) => {
  const { status, note } = payload

  // 1. Validate status
  if (!Object.values(REFUND_STATUS).includes(status)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid refund status')
  }

  // 2. Start transaction
  const session = await startSession()
  session.startTransaction()

  try {
    // 3. Find refund request
    const refund = await Refund.findById(id).session(session)
    if (!refund) {
      throw new AppError(httpStatus.NOT_FOUND, 'Refund request not found!')
    }

    // 4. Prevent invalid transitions
    if (refund.status !== REFUND_STATUS.pending) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Refund request already ${refund.status}. Cannot change status again.`,
      )
    }

    // // 5. Use payment amount if amount is not provided
    // const refundAmount = amount || refund.amount
    // if (refundAmount <= 0 || refundAmount > refund.amount) {
    //   throw new AppError(httpStatus.BAD_REQUEST, 'Invalid refund amount')
    // }

    // 6. If authority = "user" and status = "confirmed" → auto refund via Paystack
    if (status === REFUND_STATUS.confirmed) {
      // Find linked payment
      const payment = await Payment.findOne({
        reference: refund.order,
        modelType: PAYMENT_MODEL_TYPE.Order,
        isPaid: true,
        isDeleted: false,
      }).session(session)
      if (!payment || !payment.paymentIntentId) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'No payment found for this order to refund',
        )
      }

      // // Paystack-এ refund করো
      // const refundResponse = await refundPaystackPayment(
      //   Number(payment.paymentIntentId),
      //   refundAmount,
      //   `Refund requested by user for order ${refund.order}`,
      // )
      // if (!refundResponse.success) {
      //   if (refundResponse.alreadyRefunded) {
      //     throw new AppError(
      //       httpStatus.BAD_REQUEST,
      //       'Transaction already fully refunded',
      //     )
      //   }
      //   throw new AppError(
      //     httpStatus.INTERNAL_SERVER_ERROR,
      //     'Paystack refund failed',
      //   )
      // }

      // Update payment status to refunded
      await Payment.findByIdAndUpdate(
        payment._id,
        {
          // $inc: { refundedAmount: refundAmount },
          status: PAYMENT_STATUS.refunded,
        },
        { session },
      )

      // Update order refund fields
      await Order.findByIdAndUpdate(
        refund.order,
        {
          // refundAmount: refundAmount,
          status: ORDER_STATUS.refunded,
        },
        { session },
      )

      // Project received update
      await Project.findOneAndUpdate(
        { order: refund.order },
        {
          // $inc: { received: -refundAmount }, // শুধু subtract করো
          status: PROJECT_STATUS.refunded,
        },
        { session, new: true },
      )
    }

    // 7. Update refund status
    const updatedRefund = await Refund.findByIdAndUpdate(
      id,
      {
        status: REFUND_STATUS.confirmed,
        processedAt: new Date(),
        note,
      },
      { new: true, session },
    )
    if (!updatedRefund) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Refund update failed',
      )
    }

    // 8. Notify user
    const user = await User.findById(refund.user).session(session)
    if (user) {
      await refundChangeStatusNotifyToUser(
        'CHANGED_STATUS',
        user,
        updatedRefund,
        note,
      )
    }

    await session.commitTransaction()
    session.endSession()

    return updatedRefund
  } catch (error: any) {
    await session.abortTransaction()
    session.endSession()
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error.message || 'Failed to update refund status',
    )
  }
}

const deleteARefundFromDB = async (id: string) => {
  const refund = await Refund.findById(id)
  if (!refund) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'This Refund request is not found !',
    )
  }
  if (refund.status !== REFUND_STATUS.pending) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Only pending refund eligible for deleted!',
    )
  }

  const result = await Refund.findByIdAndDelete(id)
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Refund request Delete failed!')
  }

  return result
}

export const RefundServices = {
  getAllRefundsFromDB,
  getARefundFromDB,
  updateRefundStatusFromDB,
  deleteARefundFromDB,
}
