import { PaystackRecipient } from './paystackRecipient.model'
import { User } from '../user/user.model'
import { createPaystackRecipient } from '../../utils/paystack.utils' // আগের ফাংশন
import AppError from '../../errors/AppError'
import httpStatus from 'http-status'
import { startSession } from 'mongoose'
import { RECIPIENT_STATUS } from './paystackRecipient.constant'
import axios from 'axios'
import config from '../../config'
import { Verification } from '../verification/verification.models'
import { KYC_STATUS } from '../verification/verification.constants'
import emailSender from '../../utils/emailSender'
import { sendKycStatusNotification } from '../verification/verification.utils'

const connectPaystackRecipient = async (
  userId: string,
  payload: {
    accountNumber: string
    bankCode: string
    accountName: string
  },
  existingSession?: any, // ✅ Accept external session
) => {
  const session = existingSession || (await startSession())
  const shouldCommit = !existingSession // Only commit if we created the session

  try {
    if (shouldCommit) {
      await session.startTransaction()
    }

    // 1. Validate user
    const user = await User.findById(userId).session(session)
    if (!user || user.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found')
    }

    // 2. Check if recipient already exists
    const existingRecipient = await PaystackRecipient.findOne({
      user: userId,
      accountNumber: payload.accountNumber,
      isDeleted: false,
    }).session(session)

    if (existingRecipient) {
      return {
        success: true,
        recipient: existingRecipient,
        message: 'Bank account already connected',
      }
    }

    // 3. Create Paystack recipient
    const recipientData = await createPaystackRecipient({
      type: 'nuban',
      name: payload.accountName,
      account_number: payload.accountNumber,
      bank_code: payload.bankCode,
      currency: 'NGN',
      metadata: { userId },
    })

    // 4. Save to database
    const [newRecipient] = await PaystackRecipient.create(
      [
        {
          user: userId,
          recipientCode: recipientData.recipient_code,
          accountName: payload.accountName,
          accountNumber: payload.accountNumber,
          bankCode: payload.bankCode,
          bankName: recipientData.details?.bank_name || null,
          currency: 'NGN',
          status: RECIPIENT_STATUS.pending, // ← Pending until verified
          isDefault: true,
          metadata: recipientData.metadata || {},
        },
      ],
      { session },
    )

    // 5. Reset previous defaults
    await PaystackRecipient.updateMany(
      { user: userId, _id: { $ne: newRecipient._id } },
      { isDefault: false },
      { session },
    )

    // 6. Update user with recipient code (optional)
    await User.findByIdAndUpdate(
      userId,
      { playstackRecipientCode: recipientData.recipient_code },
      { session },
    )

    if (shouldCommit) {
      await session.commitTransaction()
    }

    return {
      success: true,
      recipient: newRecipient,
      message: 'Bank account added successfully. Verification in progress.',
    }
  } catch (error: any) {
    if (shouldCommit) {
      await session.abortTransaction()
    }

    throw new AppError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || 'Failed to connect Paystack account',
    )
  } finally {
    if (shouldCommit) {
      session.endSession()
    }
  }
}

export const getPaystackBanks = async () => {
  const response = await axios.get(
    'https://api.paystack.co/bank?currency=NGN&perPage=100',
    {
      headers: {
        Authorization: `Bearer ${config.paystack.secret_key}`,
      },
    },
  )
  return response.data.data
}

const getUserRecipients = async (userId: string) => {
  return await PaystackRecipient.find({
    user: userId,
    isDeleted: false,
  }).sort({ isDefault: -1, createdAt: -1 })
}

const approveVerification = async (verificationId: string) => {
  const session = await startSession()

  try {
    await session.startTransaction()

    // 1. Get verification
    const verification = await Verification.findById(verificationId)
      .populate('user')
      .session(session)

    if (!verification) {
      throw new AppError(httpStatus.NOT_FOUND, 'Verification not found')
    }

    if (verification.status === KYC_STATUS.approved) {
      throw new AppError(httpStatus.CONFLICT, 'Verification already approved')
    }

    const user = verification.user as any

    // 2. Update verification status
    verification.status = KYC_STATUS.approved
    await verification.save({ session })

    // 3. Update user verification status
    await User.findByIdAndUpdate(
      user._id,
      {
        isVerified: true,
        verifiedAt: new Date(),
      },
      { session },
    )

    // 4. Check and activate Paystack recipient if exists
    const paystackRecipient = await PaystackRecipient.findOne({
      user: user._id,
      accountNumber: verification.bankInfo.accountNumber,
    }).session(session)

    if (
      paystackRecipient &&
      paystackRecipient.status === RECIPIENT_STATUS.pending
    ) {
      paystackRecipient.status = RECIPIENT_STATUS.verified
      await paystackRecipient.save({ session })
    }

    // 5. If Paystack recipient doesn't exist, create it now
    if (!paystackRecipient) {
      try {
        await PaystackRecipientService.connectPaystackRecipient(
          user._id,
          {
            accountNumber: verification.bankInfo.accountNumber,
            bankCode: verification.bankInfo.bankCode,
            accountName: verification.bankInfo.accountName,
          },
          session,
        )
      } catch (error) {
        console.error(
          'Failed to create Paystack recipient during approval:',
          error,
        )
        // Don't fail approval if Paystack fails
      }
    }

    await session.commitTransaction()

    // 6. Send notifications
    try {
      await sendKycStatusNotification(
        verification._id as any,
        verification.user as any,
        'profile',
      )

      if (user.email) {
        await emailSender(
          user.email,
          'KYC Verification Approved',
          `
            <h2>🎉 KYC Verification Approved!</h2>
            <p>Dear ${user.name},</p>
            <p>Great news! Your KYC verification has been approved.</p>
            <p><strong>You can now:</strong></p>
            <ul>
              <li>✅ Receive payments</li>
              <li>✅ Withdraw funds</li>
              <li>✅ Access all platform features</li>
            </ul>
            <p>Your bank account has been successfully connected and verified.</p>
            <p>Thank you for completing the verification process!</p>
          `,
        )
      }
    } catch (notificationError) {
      console.error('Notification failed:', notificationError)
    }

    return {
      verification,
      message: 'Verification approved successfully',
    }
  } catch (error: any) {
    await session.abortTransaction()
    throw error instanceof AppError
      ? error
      : new AppError(
          httpStatus.INTERNAL_SERVER_ERROR,
          error.message || 'Verification approval failed',
        )
  } finally {
    session.endSession()
  }
}

const setDefaultRecipient = async (userId: string, recipientId: string) => {
  const recipient = await PaystackRecipient.findOne({
    _id: recipientId,
    user: userId,
    isDeleted: false,
  })

  if (!recipient) {
    throw new AppError(httpStatus.NOT_FOUND, 'Recipient not found')
  }

  await PaystackRecipient.updateMany({ user: userId }, { isDefault: false })

  await PaystackRecipient.findByIdAndUpdate(recipientId, { isDefault: true })

  return recipient
}

const deleteRecipient = async (userId: string, recipientId: string) => {
  const recipient = await PaystackRecipient.findOneAndUpdate(
    { _id: recipientId, user: userId },
    { isDeleted: true },
    { new: true },
  )

  if (!recipient) {
    throw new AppError(httpStatus.NOT_FOUND, 'Recipient not found')
  }

  // যদি এটা ডিফল্ট ছিল তাহলে অন্য একটা ডিফল্ট করা যেতে পারে
  if (recipient.isDefault) {
    const another = await PaystackRecipient.findOne({
      user: userId,
      isDeleted: false,
    })
    if (another) {
      await PaystackRecipient.findByIdAndUpdate(another._id, {
        isDefault: true,
      })
    }
  }

  return { success: true, message: 'Recipient deleted successfully' }
}

export const PaystackRecipientService = {
  connectPaystackRecipient,
  getPaystackBanks,
  getUserRecipients,
  approveVerification,
  setDefaultRecipient,
  deleteRecipient,
}
