import httpStatus from 'http-status'
import { TVerification } from './verification.interface'
import QueryBuilder from '../../builder/QueryBuilder'
import { Verification } from './verification.models'
import AppError from '../../errors/AppError'
import { uploadToS3 } from '../../utils/s3'
import { User } from '../user/user.model'
import { KYC_STATUS, TKycStatus } from './verification.constants'
import { sendKycStatusNotification } from './verification.utils'

// Create a new Verification
const insertIntoDB = async (
  userId: string,
  payload: TVerification,
  files: any,
) => {
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found')
  }

  const existingOne = await Verification.findOne({
    user: user._id,
  })
  if (existingOne) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'User already sent kyc verification!',
    )
  }

  // Validate uploaded files
  const uploadedFiles = files?.files

  if (!uploadedFiles || uploadedFiles.length !== 2) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Two files are required: frontSide and backSide',
    )
  }

  const [frontFile, backFile] = uploadedFiles

  // Upload front side
  const frontSideUrl = await uploadToS3({
    file: frontFile,
    fileName: `verification/front/${Date.now()}_${frontFile.originalname}`,
  })

  // Upload back side
  const backSideUrl = await uploadToS3({
    file: backFile,
    fileName: `verification/back/${Date.now()}_${backFile.originalname}`,
  })

  // Assign into payload
  payload.user = user._id
  payload.identityVerification.frontSide = frontSideUrl as string
  payload.identityVerification.backSide = backSideUrl as string

  const result = await Verification.create(payload)

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Verification creation failed')
  }

  return result
}

// Get all Verification
const getAllIntoDB = async (query: Record<string, any>) => {
  const VerificationModel = new QueryBuilder(Verification.find(), query)
    .search([''])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await VerificationModel.modelQuery
  const meta = await VerificationModel.countTotal()
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

// Update Verification
const updateAIntoDB = async (id: string, payload: { status: TKycStatus }) => {
  const { status } = payload
  const verification = await Verification.findById(id)
  if (!verification) {
    throw new AppError(httpStatus.NOT_FOUND, 'Verification not found!')
  }

  const result = await Verification.findByIdAndUpdate(
    id,
    { status },
    {
      new: true,
    },
  )
  if (!result) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Verification record not updated!',
    )
  }

  // here update user kyc status
  if (status === KYC_STATUS.approved) {
    await User.findByIdAndUpdate(
      verification.user, // reference to the user
      { isKycVerified: true },
      { new: true },
    )
  }

  // Trigger KYC Notification Util
  await sendKycStatusNotification(result)

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
