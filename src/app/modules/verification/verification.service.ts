import httpStatus from 'http-status'
import { TVerification } from './verification.interface'
import QueryBuilder from '../../builder/QueryBuilder'
import { Verification } from './verification.models'
import AppError from '../../errors/AppError'
import { uploadToS3 } from '../../utils/s3'
import { User } from '../user/user.model'
import { KYC_STATUS, TKycStatus } from './verification.constants'
import { sendKycStatusNotification } from './verification.utils'
import { PaystackRecipientService } from '../paystackRecipient/paystackRecipient.service'
import { startSession } from 'mongoose'

// Create a new Verification
const insertIntoDB = async (
  userId: string,
  payload: TVerification,
  files: any,
) => {
  const session = await startSession()

  try {
    await session.startTransaction()

    // 1. Validate user
    const user = await User.findById(userId).session(session)
    if (!user || user?.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found')
    }

    // 2. Check if verification already exists
    const existingOne = await Verification.findOne({
      user: user._id,
    }).session(session)

    if (existingOne) {
      throw new AppError(
        httpStatus.CONFLICT,
        'User already sent KYC verification!',
      )
    }

    // 3. Validate uploaded files
    const uploadedFiles = files?.files

    if (!uploadedFiles || uploadedFiles.length !== 2) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Two files are required: frontSide and backSide',
      )
    }

    const [frontFile, backFile] = uploadedFiles

    // 4. Upload front side to S3
    const frontSideUrl = await uploadToS3({
      file: frontFile,
      fileName: `verification/front/${user._id}_${Date.now()}_${frontFile.originalname}`,
    })

    // 5. Upload back side to S3
    const backSideUrl = await uploadToS3({
      file: backFile,
      fileName: `verification/back/${user._id}_${Date.now()}_${backFile.originalname}`,
    })

    // 6. Assign into payload
    payload.user = user._id
    payload.identityVerification.frontSide = frontSideUrl as string
    payload.identityVerification.backSide = backSideUrl as string

    // 7. Create verification record
    const [verification] = await Verification.create([payload], { session })

    if (!verification) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Verification creation failed')
    }

    // 8. Create Paystack recipient (bank account connection)
    let paystackRecipient = null
    let paystackError = null

    try {
      paystackRecipient =
        await PaystackRecipientService.connectPaystackRecipient(
          user._id as any,
          {
            accountNumber: payload.bankInfo.accountNumber,
            accountName: payload.bankInfo.accountName,
            bankCode: payload.bankInfo.bankCode,
          },
          session, // ✅ Pass session for transaction
        )

      console.log(
        '✅ Paystack recipient created:',
        paystackRecipient.recipient._id,
      )
    } catch (error: any) {
      paystackError = error
      console.error('❌ Paystack recipient creation failed:', error.message)

      // Don't fail verification if Paystack fails
      // Admin can manually verify and add recipient later
    }

    // 9. Commit transaction
    await session.commitTransaction()

    return {
      verification,
      paystackRecipient: paystackRecipient?.recipient || null,
      paystackStatus: paystackRecipient ? 'connected' : 'pending',
      message: paystackRecipient
        ? 'Verification submitted and bank account connected successfully'
        : 'Verification submitted successfully. Bank account will be connected after review.',
    }
  } catch (error: any) {
    await session.abortTransaction()
    throw error instanceof AppError
      ? error
      : new AppError(
          httpStatus.INTERNAL_SERVER_ERROR,
          error.message || 'Verification creation failed',
        )
  } finally {
    session.endSession()
  }
}

// Get all Verification
const getAllIntoDB = async (query: Record<string, any>) => {
  const verificationModel = new QueryBuilder(Verification.find(), query)
    .search([''])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await verificationModel.modelQuery
  const meta = await verificationModel.countTotal()
  return {
    data,
    meta,
  }
}

// Get Verification by ID
const getAIntoDB = async (id: string) => {
  const result = await Verification.findById(id).populate([
    { path: 'user', select: 'name email photoUrl isKycVerified' },
  ])
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Oops! Verification not found')
  }

  return result
}

const updateAIntoDB = async (
  id: string,
  payload: { status: TKycStatus; reason?: string },
) => {
  const { status, reason } = payload

  const verification = await Verification.findById(id)
  if (!verification) {
    throw new AppError(httpStatus.NOT_FOUND, 'Verification not found!')
  }

  // ✅ If approved → use full approval flow
  if (status === KYC_STATUS.approved) {
    return await PaystackRecipientService.approveVerification(id)
  }

  // ❌ For other statuses (rejected / pending etc.)
  const result = await Verification.findByIdAndUpdate(
    id,
    { status },
    { new: true },
  )

  if (!result) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Verification record not updated!',
    )
  }

  // Notification
  const user = await User.findById(verification.user)
  if (user && user?.fcmToken) {
    await sendKycStatusNotification(result, user, 'profile', reason)
  }

  return result
}

// Delete Verification
const deleteAIntoDB = async (id: string) => {
  const result = await Verification.findByIdAndUpdate(
    id,
    {
      $set: {
        isDeleted: true,
      },
    },
    { new: true },
  )

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Verification deletion failed')
  }

  return result
}

export const VerificationService = {
  insertIntoDB,
  getAllIntoDB,
  getAIntoDB,
  updateAIntoDB,
  deleteAIntoDB,
}
