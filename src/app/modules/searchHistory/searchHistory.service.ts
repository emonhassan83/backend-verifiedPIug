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

const getSuggestData = async (userId: string) => {
  const user = await User.findById(userId).select('role').lean()

  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found or deleted!')
  }

  // Popular categories (top 7 by listingCount)
  const popularCategories = await Category.find()
    .sort({ listingCount: -1 })
    .limit(7)
    .select('_id title')
    .lean()

  // Trending categories — dynamic + manual boost
  const trendingCategories: any[] = await Category.find({ isTreading: true })
    .sort({ listingCount: -1 })
    .limit(7)
    .select('title')

  // Suggested Planners (for user & vendor roles)
  let suggestPlanner: any[] = []
  let suggestVendor: any[] = []

  if (user.role === USER_ROLE.user || user.role === USER_ROLE.vendor) {
    suggestPlanner = await User.find({
      role: USER_ROLE.planer,
      status: USER_STATUS.active,
      isDeleted: false,
      avgRating: { $gt: 0 },
    })
      .sort({ avgRating: -1, ratingCount: -1 })
      .limit(7)
      .select('_id name')
      .lean()
  }

  if (user.role === USER_ROLE.planer) {
    suggestVendor = await User.find({
      role: USER_ROLE.vendor,
      status: USER_STATUS.active,
      isDeleted: false,
      avgRating: { $gt: 0 },
    })
      .sort({ avgRating: -1, ratingCount: -1 })
      .limit(7)
      .select('_id name')
      .lean()
  }

  const responseData: any = {
    popularCategories,
    trendingCategories,
  }

  if (user.role === USER_ROLE.user || user.role === USER_ROLE.vendor) {
    responseData.suggestPlanner = suggestPlanner
  }

  if (user.role === USER_ROLE.planer) {
    responseData.suggestVendor = suggestVendor
  }

  return responseData
}

// Create a new SearchHistory
const insertIntoDB = async (payload: TSearchHistory, userId: string) => {
  const { modelType, refId } = payload;

  // 1. User validation
  const user = await User.findById(userId);
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found or deleted!');
  }

  // 2. Reference validation with switch (clean & performant)
  let isValidRef = false;
  switch (modelType) {
    case SEARCH_MODEL_TYPE.User:
      isValidRef = !!(await User.exists({
        _id: refId,
        status: USER_STATUS.active,
        isDeleted: false,
      }));
      break;

    case SEARCH_MODEL_TYPE.Service:
      isValidRef = !!(await Service.exists({
        _id: refId,
        status: SERVICE_STATUS.active,
        isDeleted: false,
      }));
      break;

    case SEARCH_MODEL_TYPE.Category:
      isValidRef = !!(await Category.exists({
        _id: refId
      }));
      break;

    default:
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid model type!');
  }

  if (!isValidRef) {
    throw new AppError(httpStatus.NOT_FOUND, `Invalid ${modelType} reference ID!`);
  }

  // 3. Upsert search history (prevents duplicates + updates timestamp)
  const history = await SearchHistory.findOneAndUpdate(
    { userId, modelType, refId },
    {
      $setOnInsert: { createdAt: new Date() }, // only on insert
      $set: { updatedAt: new Date() },         // always update timestamp
    },
    {
      upsert: true,
      new: true,         // return the new/updated document
      setDefaultsOnInsert: true,
    }
  );

  // 4. Return clean object
  return history
};

// Get all SearchHistory
const getAllIntoDB = async (query: Record<string, any>, userId: string) => {
  const user = await User.findById(userId).select('role').lean()

  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found or deleted!')
  }

  // Popular categories (top 7 by listingCount)
  const popularCategories = await Category.find()
    .sort({ listingCount: -1 })
    .limit(6)
    .select('_id title')
    .lean()

  // Trending categories — dynamic + manual boost
  const trendingCategories: any[] = await Category.find({ isTreading: true })
    .sort({ listingCount: -1 })
    .limit(6)
    .select('title')

  // Suggested Planners (for user & vendor roles)
  let suggestPlanner: any[] = []
  let suggestVendor: any[] = []

  if (user.role === USER_ROLE.user || user.role === USER_ROLE.vendor) {
    suggestPlanner = await User.find({
      role: USER_ROLE.planer,
      status: USER_STATUS.active,
      isDeleted: false,
      avgRating: { $gt: 0 },
    })
      .sort({ avgRating: -1, ratingCount: -1 })
      .limit(6)
      .select('_id name')
      .lean()
  }

  if (user.role === USER_ROLE.planer) {
    suggestVendor = await User.find({
      role: USER_ROLE.vendor,
      status: USER_STATUS.active,
      isDeleted: false,
      avgRating: { $gt: 0 },
    })
      .sort({ avgRating: -1, ratingCount: -1 })
      .limit(7)
      .select('_id name')
      .lean()
  }

  const responseData: any = {
    popularCategories,
    trendingCategories,
  }

  if (user.role === USER_ROLE.user || user.role === USER_ROLE.vendor) {
    responseData.suggestPlanner = suggestPlanner
  }

  if (user.role === USER_ROLE.planer) {
    responseData.suggestVendor = suggestVendor
  }

  const SearchHistoryModel = new QueryBuilder(
    SearchHistory.find().populate([
      { path: 'refId', select: '_id name title photoUrl images logo' },
    ]).select('modelType refId createdAt').lean(),
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
    data: { ...responseData, searchHistory: data },
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
  getSuggestData,
  insertIntoDB,
  getAllIntoDB,
  clearSearchHistory,
  deleteAIntoDB,
}
