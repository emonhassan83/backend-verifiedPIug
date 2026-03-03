import httpStatus from 'http-status'
import { TCategory } from './categories.interface'
import QueryBuilder from '../../builder/QueryBuilder'
import { Category } from './categories.models'
import AppError from '../../errors/AppError'
import { uploadToS3 } from '../../utils/s3'

// Create a new Category
const insertIntoDB = async (payload: TCategory, file: any) => {
  // Check for duplicates using collation
  const isExist = await Category.findOne({
    title: { $regex: `^${payload.title}$`, $options: 'i' },
  })
  if (isExist) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Category "${payload.title}" already exists`,
    )
  }

  // upload to service image
  if (file) {
    payload.logo = (await uploadToS3({
      file,
      fileName: `images/categories/logo/${Math.floor(100000 + Math.random() * 900000)}`,
    })) as string
  }

  const result = await Category.create(payload)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Category creation failed')
  }

  return result
}

// Get all category
const getAllIntoDB = async (query: Record<string, any>) => {
  const CategoryModel = new QueryBuilder(
    Category.find({ isDeleted: false }),
    query,
  )
    .search(['title'])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await CategoryModel.modelQuery
  const meta = await CategoryModel.countTotal()
  return {
    data,
    meta,
  }
}

// Get Category by ID
const getAIntoDB = async (id: string) => {
  const result = await Category.findById(id)
  if (!result || result?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Oops! Category not found')
  }

  return result
}

// Update Category
const updateAIntoDB = async (
  id: string,
  payload: Partial<TCategory>,
  file: any,
) => {
  const category = await Category.findById(id)
  if (!category || category?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found!')
  }

  // upload to service image
  if (file) {
    payload.logo = (await uploadToS3({
      file,
      fileName: `images/categories/logo/${Math.floor(100000 + Math.random() * 900000)}`,
    })) as string
  }

  const result = await Category.findByIdAndUpdate(id, payload, {
    new: true,
  })
  if (!result) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Category record not updated!',
    )
  }

  return result
}

// Toggle Trading Category
const toggleTradingCategory = async (id: string) => {
  const category = await Category.findById(id)
  if (!category || category?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found!')
  }

  const updatedCategory = await Category.findByIdAndUpdate(
    id,
    { isTreading: !category.isTreading },
    { new: true },
  )

  return updatedCategory
}

// Delete Category
const deleteAIntoDB = async (id: string) => {
  const category = await Category.findById(id)
  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found!')
  }

  const result = await Category.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true },
  )

  return result
}

export const CategoryService = {
  insertIntoDB,
  getAllIntoDB,
  getAIntoDB,
  updateAIntoDB,
  toggleTradingCategory,
  deleteAIntoDB,
}
