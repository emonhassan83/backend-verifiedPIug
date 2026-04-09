import { PaystackRecipient } from './paystackRecipient.model'
import { User } from '../user/user.model'
import { createPaystackRecipient } from '../../utils/paystack.utils' // আগের ফাংশন
import AppError from '../../errors/AppError'
import httpStatus from 'http-status'
import mongoose, { startSession } from 'mongoose'
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

    // Check if the user is KYC verified
    if (!user?.isKycVerified) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Your account is not kyc verified. Please complete kyc verification to create a subscription.',
      )
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
      { new: true, session },
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
  }).sort({ createdAt: -1 })
}

const approveVerification = async (
  verificationId: string,
  session: mongoose.ClientSession, // ← session প্যারামিটার নিন
) => {
  try {
    // No new transaction here! Use the passed session

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
        isKycVerified: true, // Note: isKycVerified (আপনার মডেল অনুযায়ী)
        verifiedAt: new Date(),
      },
      { session },
    )

    // 4. Update or activate Paystack recipient if exists
    const paystackRecipient = await PaystackRecipient.findOne({
      user: user._id,
      accountNumber: verification.bankInfo.accountNumber,
    }).session(session)

    if (paystackRecipient) {
      if (paystackRecipient.status === RECIPIENT_STATUS.pending) {
        paystackRecipient.status = RECIPIENT_STATUS.verified
        await paystackRecipient.save({ session })
      }
    }
    // 5. If no recipient exists, create one
    else {
      try {
        await PaystackRecipientService.connectPaystackRecipient(
          user._id,
          {
            accountNumber: verification.bankInfo.accountNumber,
            bankCode: verification.bankInfo.bankCode,
            accountName: verification.bankInfo.accountName,
          },
          session, // ← session পাস করুন
        )
      } catch (paystackError) {
        console.error(
          'Failed to create Paystack recipient during KYC approval:',
          paystackError,
        )
        // Don't fail the whole approval for this
      }
    }

    // 6. Notifications & Email (transaction এর বাইরে রাখা ভালো)
    // কিন্তু এখানে transaction চলছে, তাই শুধু logging করুন
    console.log(`KYC approved for user ${user._id}`)

    return {
      success: true,
      verification,
      message: 'Verification approved successfully',
    }
  } catch (error: any) {
    console.error('Approve Verification Error:', error)
    throw error instanceof AppError
      ? error
      : new AppError(
          httpStatus.INTERNAL_SERVER_ERROR,
          error.message || 'Verification approval failed',
        )
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
