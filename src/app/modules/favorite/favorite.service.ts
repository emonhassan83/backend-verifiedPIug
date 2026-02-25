import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { Favorite } from './favorite.model'
import { User } from '../user/user.model'
import { Service } from '../service/service.models'
import { SERVICE_STATUS } from '../service/service.constants'

const insertIntoDB = async (userId: string, serviceId: string) => {
  // 1️⃣ Validate User
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  // 2️⃣ Validate Service
  const service = await Service.findOne({
    _id: serviceId,
    status: SERVICE_STATUS.active,
    isDeleted: false,
  })
  if (!service) {
    throw new AppError(httpStatus.NOT_FOUND, 'Service not found!')
  }

  // 3️⃣ Check existing favorite
  const existingFavorite = await Favorite.findOne({
    user: userId,
    service: serviceId,
  })

  // 🔁 Toggle OFF
  if (existingFavorite) {
    await Favorite.findByIdAndDelete(existingFavorite._id)

    return {
      isFavorite: false,
      message: 'Favorite removed successfully!',
    }
  }

  // 🔁 Toggle ON
  const favorite = await Favorite.create({
    user: userId,
    service: serviceId,
  })
  if (!favorite) {
    throw new AppError(httpStatus.CONFLICT, 'Favorite not created!')
  }

  return {
    isFavorite: true,
    message: 'Favorite added successfully!',
    data: favorite,
  }
}

const getAllIntoDB = async (query: Record<string, unknown>) => {
  const favoriteQuery = new QueryBuilder(
    Favorite.find().populate([
      {
        path: 'service',
        select: 'title author subtitle images price priceType',
        populate: {
          path: 'author',
          select: 'name photoUrl ratingCount avgRating',
        },
      },
    ]),
    query,
  )
    .search([''])
    .filter()
    .sort()
    .paginate()
    .fields()

  const result = await favoriteQuery.modelQuery
  const meta = await favoriteQuery.countTotal()

  return {
    meta,
    result,
  }
}

const getAIntoDB = async (id: string) => {
  const result = await Favorite.findById(id).populate([
    {
      path: 'service',
      populate: {
        path: 'author',
        select: 'name photoUrl ratingCount avgRating',
      },
    },
  ])
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Favorites not found')
  }

  return result
}

const deleteAIntoDB = async (favoriteId: string, userId: string) => {
  // 1️⃣ Validate User
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  const deal = await Favorite.findById({
    _id: favoriteId,
    userId,
  })
  if (!deal) {
    throw new AppError(httpStatus.NOT_FOUND, 'Favorites not found')
  }

  // Delete favorite
  const result = await Favorite.findByIdAndDelete(favoriteId)
  if (!result) {
    throw new AppError(httpStatus.CONFLICT, 'Favorite not removed!')
  }

  return result
}

export const FavoriteService = {
  insertIntoDB,
  getAllIntoDB,
  getAIntoDB,
  deleteAIntoDB,
}
