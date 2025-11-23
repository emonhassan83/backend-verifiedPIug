import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { Favorite } from './favorite.model'
import { User } from '../user/user.model'
import { Service } from '../service/service.models'

const insertIntoDB = async (userId: string, serviceId: string) => {
   // 1. Validate User
  const user = await User.findById(userId);
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // 2. Validate Service
  const service = await Service.findById(serviceId);
  if (!service || service?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Service not found!');
  }

  // 3. Check if already favorited
  const existingFavorite = await Favorite.findOne({
    user: userId,
    service: serviceId
  });

  if (existingFavorite) {
    // If exists → remove it (toggle off)
    await Favorite.findByIdAndDelete(existingFavorite._id);

    return {
      isFavorite: false,
      message: 'Favorite removed successfully!'
    };
  }

  // 4. Create new favorite (toggle on)
  const favorite = await Favorite.create({
    user: userId,
    service: serviceId
  });

  if (!favorite) {
    throw new AppError(httpStatus.CONFLICT, 'Favorite not created!');
  }

  return {
    isFavorite: true,
    message: 'Favorite added successfully!',
    data: favorite
  };
}

const getAllIntoDB = async (query: Record<string, unknown>) => {
  const favoriteQuery = new QueryBuilder(Favorite.find(), query)
    .search([''])
    .filter()
    .sort()
    .paginate()
    .fields()

  const result = await favoriteQuery.modelQuery
  const meta = await favoriteQuery.countTotal()
  if (!favoriteQuery) {
    throw new AppError(httpStatus.NOT_FOUND, 'Favorite not found!')
  }

  return {
    meta,
    result,
  }
}

const getAIntoDB = async (id: string) => {
  const result = await Favorite.findById(id).populate('service')
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Favorites not found')
  }

  return result
}

export const FavoriteService = {
  insertIntoDB,
  getAllIntoDB,
  getAIntoDB
}
