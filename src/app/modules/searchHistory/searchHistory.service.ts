import httpStatus from 'http-status'
import { TSearchHistory } from './searchHistory.interface'
import QueryBuilder from '../../builder/QueryBuilder'
import { SearchHistory } from './searchHistory.models'
import AppError from '../../errors/AppError'
import { uploadToS3 } from '../../utils/s3'
import { User } from '../user/user.model'

// Create a new SearchHistory
const insertIntoDB = async (userId: string, payload: TSearchHistory) => {
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your profile not found')
  }

  // assign payload
  payload.user = user._id

  const result = await SearchHistory.create(payload)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'SearchHistory creation failed')
  }

  return result
}

// Get all SearchHistory
const getAllIntoDB = async (query: Record<string, any>) => {
  const SearchHistoryModel = new QueryBuilder(
    SearchHistory.find({ isDeleted: false }),
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
  insertIntoDB,
  getAllIntoDB,
  clearSearchHistory,
  deleteAIntoDB,
}
