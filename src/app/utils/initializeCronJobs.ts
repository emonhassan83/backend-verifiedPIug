import cron from 'node-cron'
import dayjs from 'dayjs'
import { User } from '../modules/user/user.model'
import { Withdraw } from '../modules/withdraw/withdraw.model'
import { WITHDRAW_STATUS } from '../modules/withdraw/withdraw.constant'
import axios from 'axios'
import { PaystackRecipient } from '../modules/paystackRecipient/paystackRecipient.model'
import config from '../config'
import { Subscription } from '../modules/subscription/subscription.models'
import { PAYMENT_STATUS } from '../modules/subscription/subscription.constants'
import { subscriptionNotifyToUser } from '../modules/subscription/subscription.utils'
import { sendWithdrawCompletedEmail } from './emailNotify'
import { Order } from '../modules/order/order.models'
import mongoose from 'mongoose'

/**
 * Initializes and starts all scheduled cron jobs.
 * This function should be called once during server startup.
 */
export const initializeCronJobs = () => {
  // Run every day at 00:05 AM
  cron.schedule('5 0 * * *', async () => {
    console.log('Running daily withdraw processor (3-day delay)...')

    const now = new Date()

    // Find pending withdraws whose proceedAt is <= now
    const pendingWithdraws = await Withdraw.find({
      status: WITHDRAW_STATUS.pending,
      proceedAt: { $lte: now },
      isDeleted: false,
    }).limit(50) // batch limit to avoid overload

    if (pendingWithdraws.length === 0) {
      console.log('No pending withdraws to process')
      return // Safe exit
    }

    console.log(
      `Found ${pendingWithdraws.length} pending withdrawals to process`,
    )

    let processedCount = 0
    let failedCount = 0

    for (const withdraw of pendingWithdraws) {
      const session = await mongoose.startSession()
      session.startTransaction()

      try {
        // 1. Lock the withdraw record (prevent concurrent processing)
        const lockedWithdraw = await Withdraw.findOneAndUpdate(
          {
            _id: withdraw._id,
            status: WITHDRAW_STATUS.pending,
          },
          { $set: { status: WITHDRAW_STATUS.proceed } },
          { new: true, session },
        )

        if (!lockedWithdraw) {
          console.log(
            `Withdraw ${withdraw._id} already being processed or completed - skipping`,
          )
          await session.commitTransaction()
          session.endSession()
          continue
        }

        // 2. Fetch user and default recipient
        const user = await User.findById(withdraw.user).session(session)
        if (!user) {
          throw new Error(`User ${withdraw.user} not found`)
        }

        const recipient = await PaystackRecipient.findOne({
          user: withdraw.user,
          isDefault: true,
          isDeleted: false,
          status: 'verified',
        }).session(session)

        if (!recipient || !recipient.recipientCode) {
          throw new Error(
            `No verified default recipient found for user ${withdraw.user}`,
          )
        }

        // 3. Perform Paystack transfer
        const response = await axios.post(
          'https://api.paystack.co/transfer',
          {
            source: 'balance',
            amount: withdraw.amount * 100, // in kobo
            recipient: recipient.recipientCode,
            reason: withdraw.note || 'Planner earning payout',
          },
          {
            headers: {
              Authorization: `Bearer ${config.paystack.secret_key}`,
              'Content-Type': 'application/json',
            },
          },
        )

        if (!response.data.status) {
          throw new Error(`Paystack transfer failed: ${response.data.message}`)
        }

        const transferData = response.data.data

        // 4. Update withdraw record
        await Withdraw.findByIdAndUpdate(
          withdraw._id,
          {
            paystackTransferId: transferData.id,
            recipientCode: recipient.recipientCode,
            status: WITHDRAW_STATUS.completed,
            proceedAt: new Date(), // actual completion time
          },
          { session },
        )

        // 5. Deduct balance from user (planner)
        await User.findByIdAndUpdate(
          withdraw.user,
          { $inc: { balance: -withdraw.amount } },
          { session },
        )

        // Optional: Send success email to planner
        const order = await Order.findById(withdraw.order)
        if (order) {
          await sendWithdrawCompletedEmail(user, withdraw, order)
        }

        await session.commitTransaction()
        processedCount++
        console.log(
          `Withdraw ${withdraw._id} processed successfully: ₦${withdraw.amount}`,
        )
      } catch (error: any) {
        await session.abortTransaction()
        failedCount++
        console.error(`Failed to process withdraw ${withdraw._id}:`, error)

        // Mark as failed (no retry here - can be retried next day)
        await Withdraw.findByIdAndUpdate(withdraw._id, {
          status: WITHDRAW_STATUS.failed,
          note: `Failed: ${error.message || 'Unknown error'}`,
        }).catch((err) =>
          console.error('Failed to mark withdraw as failed:', err),
        )
      } finally {
        session.endSession()
      }
    }

    console.log(
      `Withdraw processing completed: ${processedCount} success, ${failedCount} failed`,
    )
  })

  // 2.subscription check every 12 hours
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
        const user = await User.findById(subscription.user).select('fcmToken')

        if (user && user?.fcmToken) {
          await subscriptionNotifyToUser('WARNING', subscription, user)
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
        await subscription.save()
      }

      console.log(
        `✅ Subscription check done: ${expiringToday.length} warnings, ${alreadyExpired.length} marked expired.`,
      )
    } catch (error) {
      console.error('❌ Subscription cron job error:', error)
    }
  })

  console.log('All cron jobs initialized successfully')
}
