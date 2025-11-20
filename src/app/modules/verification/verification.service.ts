import httpStatus from 'http-status'
import { TVerification } from './verification.interface'
import QueryBuilder from '../../builder/QueryBuilder'
import { Verification } from './verification.models'
import AppError from '../../errors/AppError'
import { uploadToS3 } from '../../utils/s3'

// Create a new Verification
const insertIntoDB = async (payload: TVerification, file: any) => {
  // upload to service image
  if (file) {
    payload.identityVerification.frontSide = (await uploadToS3({
      file,
      fileName: `images/categories/logo/${Math.floor(100000 + Math.random() * 900000)}`,
    })) as string
  }

  const result = await Verification.create(payload)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Verification creation failed')
  }

  return result
}

// Get all Verification
const getAllIntoDB = async (query: Record<string, any>) => {
  const VerificationModel = new QueryBuilder(
    Verification.find(),
    query,
  )
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
  const result = await Verification.findById(id)
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Oops! Verification not found')
  }

  return result
}

// Update Verification
const updateAIntoDB = async (
  id: string,
  payload: Partial<TVerification>,
) => {
  const verification = await Verification.findById(id)
  if (!verification) {
    throw new AppError(httpStatus.NOT_FOUND, 'Verification not found!')
  }

  const result = await Verification.findByIdAndUpdate(id, payload, {
    new: true,
  })
  if (!result) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Verification record not updated!',
    )
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
