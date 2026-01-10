import httpStatus from 'http-status'
import { SEARCH_MODEL_TYPE, TSearchHistory } from './searchHistory.interface'
import QueryBuilder from '../../builder/QueryBuilder'
import { SearchHistory } from './searchHistory.models'
import AppError from '../../errors/AppError'
import { User } from '../user/user.model'
import { USER_ROLE, USER_STATUS } from '../user/user.constant'
import { Service } from '../service/service.models'
import { SERVICE_STATUS } from '../service/service.constants'
import { Category } from '../categories/categories.models'

const searchDataIntoDB = async (query: Record<string, unknown>) => {
  const { searchTerm } = query

  if (
    !searchTerm ||
    typeof searchTerm !== 'string' ||
    searchTerm.trim() === ''
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Search term is required and must be a non-empty string',
    )
  }

  const searchRegex = new RegExp(searchTerm.trim(), 'i')

  // 1. Search Planner Profiles (role: planner, active)
  const planner = await User.find({
    role: USER_ROLE.planer,
    status: USER_STATUS.active,
    isDeleted: false,
    $or: [{ name: { $regex: searchRegex } }],
  })
    .select('_id name photoUrl')
    .lean()

  // 2. Search service
  const service = await Service.find({
    isDeleted: false,
    status: SERVICE_STATUS.active,
    $or: [{ title: { $regex: searchRegex } }],
  })
    .select('title images')
    .lean()

  // 3. Search category
  const categories = await Category.find({
    isDeleted: false,
    $or: [{ title: { $regex: searchRegex } }],
  })
    .select('title logo')
    .lean()

  return {
    planner: planner,
    service: service,
    categories: categories,
  }
}

// Create a new SearchHistory
const insertIntoDB = async (payload: TSearchHistory, userId: string) => {
  const { modelType, refId } = payload

  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Author not found!')
  }

  //  Validate refId based on modelType - using switch for better readability & performance
  let isValidRef = false

  switch (modelType) {
    case SEARCH_MODEL_TYPE.User:
      isValidRef = !!(await User.exists({
        _id: refId,
        status: USER_STATUS.active,
        isDeleted: false,
      }))
      break

    case SEARCH_MODEL_TYPE.Service:
      isValidRef = !!(await Service.exists({
        _id: refId,
        status: SERVICE_STATUS.active,
        isDeleted: false,
      }))
      break

    case SEARCH_MODEL_TYPE.Category:
      isValidRef = !!(await Category.exists({
        _id: refId,
        isDeleted: false,
      }))
      break

    default:
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid model type!')
  }

  if (!isValidRef) {
    throw new AppError(httpStatus.NOT_FOUND, `Invalid ${modelType} reference!`)
  }

  // 3. Check existing history - upsert style (fastest way to avoid race conditions)
  const existing = await SearchHistory.findOneAndUpdate(
    { userId: user._id, modelType, refId },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  // 4. Return result
  return existing;
}

// Get all SearchHistory
const getAllIntoDB = async (query: Record<string, any>) => {
  const SearchHistoryModel = new QueryBuilder(
    SearchHistory.find().populate([{path: "refId", select: "_id name title photoUrl images logo"}]),
    query,
  )
    .search([''])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await SearchHistoryModel.modelQuery
  const meta = await SearchHistoryModel.countTotal()
  return {
    data,
    meta,
  }
}

// Get SearchHistory by ID
const clearSearchHistory = async (userId: string) => {
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your profile not found')
  }

  const result = await SearchHistory.deleteMany({ user: user._id })
  if (result.deletedCount === 0) {
    throw new AppError(httpStatus.NOT_FOUND, 'No search history found to clear')
  }

  return result
}

// Delete SearchHistory
const deleteAIntoDB = async (id: string) => {
  const result = await SearchHistory.findByIdAndDelete(id)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'SearchHistory deletion failed')
  }

  return result
}

export const SearchHistoryService = {
  searchDataIntoDB,
  insertIntoDB,
  getAllIntoDB,
  clearSearchHistory,
  deleteAIntoDB,
}
