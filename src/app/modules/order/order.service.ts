import httpStatus from 'http-status'
import { TService } from './order.interface'
import QueryBuilder from '../../builder/QueryBuilder'
import { Service } from './order.models'
import AppError from '../../errors/AppError'
import { uploadToS3 } from '../../utils/s3'
import { User } from '../user/user.model'
import { Category } from '../categories/categories.models'
import { SERVICE_STATUS } from './order.constants'

// Create a new Service
const insertIntoDB = async (userId: string, payload: TService, files: any) => {
  const { category: categoryId } = payload

  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found')
  }

  const category = await Category.findById(categoryId)
  if (!category || category?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found')
  }

  // Ensure files exist
  const uploadedFiles = files?.images
  if (!uploadedFiles || uploadedFiles.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'At least one image is required')
  }

  // Upload all images
  const imageUrls: string[] = []

  for (const file of uploadedFiles) {
    const uploadedUrl = (await uploadToS3({
      file,
      fileName: `images/services/${Date.now()}-${Math.floor(
        100000 + Math.random() * 900000,
      )}`,
    })) as string

    imageUrls.push(uploadedUrl)
  }

  // Assign to payload
  payload.images = imageUrls
  payload.author = user._id

  const result = await Service.create(payload)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Service creation failed')
  }

  return result
}

// Get all Service
const getAllIntoDB = async (query: Record<string, any>) => {
  const ServiceModel = new QueryBuilder(
    Service.find({ isDeleted: false }),
    query,
  )
    .search(['title'])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await ServiceModel.modelQuery
  const meta = await ServiceModel.countTotal()
  return {
    data,
    meta,
  }
}

// Get Service by ID
const getAIntoDB = async (id: string) => {
  const result = await Service.findById(id)
  if (!result || result?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Oops! Service not found')
  }

  return result
}

// Update Service
const updateAIntoDB = async (
  id: string,
  payload: Partial<TService>,
  files: any,
) => {
  const service = await Service.findById(id)
  if (!service || service?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Service not found!')
  }

  // Ensure files exist
  const uploadedFiles = files?.images
  if (!uploadedFiles || uploadedFiles.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'At least one image is required')
  }

  // Upload all images
  const imageUrls: string[] = []

  for (const file of uploadedFiles) {
    const uploadedUrl = (await uploadToS3({
      file,
      fileName: `images/services/${Date.now()}-${Math.floor(
        100000 + Math.random() * 900000,
      )}`,
    })) as string

    imageUrls.push(uploadedUrl)
  }

  // Assign to payload
  payload.images = imageUrls

  const result = await Service.findByIdAndUpdate(id, payload, {
    new: true,
  })
  if (!result) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Service record not updated!',
    )
  }

  return result
}

const changeStatusFromDB = async (id: string, payload: any) => {
  const { status } = payload

  const service = await Service.findById(id)
  if (!service || service?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Service not found!')
  }

  // Capture old status
  const oldStatus = service.status

  const result = await Service.findByIdAndUpdate(
    service._id,
    { status },
    { new: true },
  )
  if (!result) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'User not found and failed to update status!',
    )
  }

  // Update category listing count
  if (oldStatus !== status && status === SERVICE_STATUS.active) {
    await Category.findByIdAndUpdate(
      service.category,
      { $inc: { listingCount: 1 } },
      { new: true },
    )
  }

  return result
}

// Delete Service
const deleteAIntoDB = async (id: string) => {
  const result = await Service.findByIdAndUpdate(
    id,
    {
      $set: {
        isDeleted: true,
      },
    },
    { new: true },
  )

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Service deletion failed')
  }

  return result
}

export const ServiceService = {
  insertIntoDB,
  getAllIntoDB,
  getAIntoDB,
  updateAIntoDB,
  changeStatusFromDB,
  deleteAIntoDB,
}
