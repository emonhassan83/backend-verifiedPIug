import httpStatus from 'http-status'
import { TService } from './service.interface'
import QueryBuilder from '../../builder/QueryBuilder'
import { Service } from './service.models'
import AppError from '../../errors/AppError'
import { uploadToS3 } from '../../utils/s3'
import { User } from '../user/user.model'
import { Category } from '../categories/categories.models'
import {
  SERVICE_AUTHORITY,
  SERVICE_STATUS,
  TServiceStatus,
} from './service.constants'
import {
  attachFavoriteFlag,
  sendServiceStatusNotifyToAuthor,
} from './service.utils'
import { Favorite } from '../favorite/favorite.model'
import { USER_ROLE } from '../user/user.constant'
import { checkSubscriptionPermission } from '../../utils/subscription.utils'
import mongoose from 'mongoose'

const generateGoogleMapUrl = (lat: number, lng: number) => {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

/**
 * Create a new service/listing with subscription-based active listing limit check
 */
const insertIntoDB = async (userId: string, payload: TService, files: any) => {
  const { category: categoryId, latitude, longitude } = payload

  // 1. Validate user
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found')
  }

  // 2. Check subscription permission & get current level
  const { level } = await checkSubscriptionPermission(
    userId,
    'canCreateListings',
  )

  // 3. Validate category
  const category = await Category.findById(categoryId)
  if (!category || category.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found')
  }

  // 4. Validate location
  if (!latitude || !longitude) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Latitude and longitude are required',
    )
  }

  // 5. Enforce active listing limit based on subscription level
  const currentActiveCount = await Service.countDocuments({
    author: userId,
    status: SERVICE_STATUS.active,
    isDeleted: false,
  })

  let maxAllowed = Infinity

  if (level === 'starter') {
    maxAllowed = 1
  } else if (level === 'pro') {
    maxAllowed = 10
  } else if (level === 'elite') {
    maxAllowed = Infinity // unlimited
  }

  if (currentActiveCount >= maxAllowed) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `You have reached the maximum listings limit for plan (${level}). ` +
        `Please upgrade to ${level === 'starter' ? 'Pro' : 'Elite'} plan for more listings.`,
    )
  }

  // 6. Handle image uploads
  const uploadedFiles = files?.files
  if (!uploadedFiles || uploadedFiles.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'At least one image is required')
  }

  const imageUrls: string[] = []
  for (const file of uploadedFiles) {
    const uploadedUrl = (await uploadToS3({
      file,
      fileName: `images/services/${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`,
    })) as string

    imageUrls.push(uploadedUrl)
  }

  // 7. Prepare location URL and coordinates
  const locationUrl = generateGoogleMapUrl(latitude, longitude)

  // 8. Final payload setup
  const finalPayload = {
    ...payload,
    images: imageUrls,
    author: user._id,
    authority: user.role as 'vendor' | 'planer',
    locationUrl,
    location: {
      type: 'Point',
      coordinates: [longitude, latitude], // MongoDB GeoJSON format: [lng, lat]
    },
    status: SERVICE_STATUS.pending, // default pending for review
  }

  // 9. Create service
  const result = await Service.create(finalPayload)
  if (!result) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Service creation failed',
    )
  }

  return result
}

// Get all Service
const getAllIntoDB = async (query: Record<string, any>, userId: string) => {
  const ServiceModel = new QueryBuilder(
    Service.find({ isDeleted: false })
      .select(
        'title subtitle images address locationUrl location author category isFeatured status',
      )
      .populate([
        {
          path: 'author',
          select:
            'name photoUrl email role categories avgRating ratingCount isKycVerified',
        },
        { path: 'category', select: 'title' },
      ]),
    query,
  )
    .search(['title'])
    .filter()
    .paginate()
    .sort()
    .fields()

  const services = await ServiceModel.modelQuery
  const meta = await ServiceModel.countTotal()

  const data = await attachFavoriteFlag(services, userId)

  return {
    data,
    meta,
  }
}

const getAllRecommendServices = async (
  query: Record<string, any>,
  userId: string,
) => {
  // 1️⃣ Validate User
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found')
  }

  if (
    !user.location ||
    !user.location.coordinates ||
    user.location.coordinates.length !== 2
  ) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User location is not set!')
  }

  const [userLng, userLat] = user.location.coordinates

  // 2️⃣ Geo filter (5 KM)
  const baseQuery = {
    isDeleted: false,
    status: SERVICE_STATUS.active,
    authority:
      user.role === USER_ROLE.user
        ? SERVICE_AUTHORITY.planer
        : SERVICE_AUTHORITY.vendor,
    location: {
      $geoWithin: {
        $centerSphere: [[userLng, userLat], 5000 / 6378137],
      },
    },
  }

  // 3️⃣ Query Builder (Search, Filter, Pagination)
  const serviceQuery = new QueryBuilder(
    Service.find(baseQuery)
      .select('title subtitle images address locationUrl location author')
      .populate([
        {
          path: 'author',
          select:
            'name photoUrl categories avgRating ratingCount isKycVerified',
        },
        { path: 'category', select: 'title' },
      ]),
    query,
  )
    .search(['title', 'subtitle'])
    .filter()
    .sort()
    .paginate()
    .fields()

  const services = await serviceQuery.modelQuery
  const meta = await serviceQuery.countTotal()

  const data = await attachFavoriteFlag(services, userId)

  return {
    meta,
    data,
  }
}

// Get Service by ID
const getAIntoDB = async (id: string, userId: string) => {
  const result = await Service.findById(id).populate([
    {
      path: 'author',
      select:
        'name photoUrl categories bio address locationUrl avgRating ratingCount isKycVerified',
    },
    { path: 'category', select: 'title' },
  ])
  if (!result || result?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Oops! Service not found')
  }

  const favorite = await Favorite.findOne({
    user: userId,
    service: id,
  })

  return {
    ...result.toObject(),
    isFavorite: !!favorite,
  }
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

  /* -------------------- LOCATION UPDATE -------------------- */
  const latitude = (payload as any)?.latitude
  const longitude = (payload as any)?.longitude

  if (latitude && longitude) {
    const locationUrl = generateGoogleMapUrl(latitude, longitude)

    payload.locationUrl = locationUrl
    payload.location = {
      type: 'Point',
      coordinates: [longitude, latitude], // MongoDB: [lng, lat]
    }
  }

  // -------------------- Images Handling (Replace old images) --------------------
  let finalImages: string[] = []

  const uploadedFiles = files?.files

  if (
    uploadedFiles &&
    Array.isArray(uploadedFiles) &&
    uploadedFiles.length > 0
  ) {
    const newImageUrls: string[] = []
    for (const file of uploadedFiles) {
      const uploadedUrl = (await uploadToS3({
        file,
        fileName: `images/services/${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`,
      })) as string

      newImageUrls.push(uploadedUrl)
    }

    finalImages = newImageUrls
  } else {
    finalImages = service.images || []
  }

  payload.images = finalImages

  // -------------------- Final Update --------------------
  const result = await Service.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  })

  if (!result) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Service record not updated!',
    )
  }

  return result
}

const changeStatusFromDB = async (
  id: string,
  payload: { status: TServiceStatus; reason?: string },
) => {
  const { status, reason } = payload

  const service = await Service.findById(id).populate('author')
  if (!service || service.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Service not found!')
  }

  const oldStatus = service.status

  const result = await Service.findByIdAndUpdate(
    service._id,
    { status },
    { new: true },
  )

  if (!result) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Service not found and failed to update status!',
    )
  }

  // 📊 Category listing logic (only when activated)
  if (oldStatus !== status && status === SERVICE_STATUS.active) {
    await Category.findByIdAndUpdate(
      service.category,
      { $inc: { listingCount: 1 } },
      { new: true },
    )
  }

  // 🔔 Send notification only if status changed
  await sendServiceStatusNotifyToAuthor(
    status,
    service.author as any,
    service,
    'service',
    reason,
  )

  return result
}

const changeFeaturedService = async (id: string, userId: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Find the service
    const service = await Service.findById(id)
      .populate('author')
      .session(session);

    if (!service || service.isDeleted) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Service not found or has been deleted'
      );
    }

    // 2. Authorization: only the author can toggle
    if (service.author._id.toString() !== userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You are not authorized to change featured status of this service'
      );
    }

    // 3. Get user's current subscription level
    const { level } = await checkSubscriptionPermission(userId, 'featuredPlacement');

    // 4. Define max allowed featured services per month
    let maxAllowed = 0;
    if (level === 'pro') {
      maxAllowed = 1;
    } else if (level === 'elite') {
      maxAllowed = 3;
    } // starter/free = 0

    // 5. Calculate how many services this author has featured in the current month
    // Using featuredAt field (only counts when featuredAt is set)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const featuredThisMonthCount = await Service.countDocuments({
      author: userId,
      isFeatured: true,
      featuredAt: { $gte: startOfMonth, $lte: endOfMonth },
      isDeleted: false,
    }).session(session);

    // 6. If turning ON featured → check limit
    const newFeaturedStatus = !service.isFeatured;

    if (newFeaturedStatus) {
      if (featuredThisMonthCount >= maxAllowed) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          `You have reached your monthly featured listing limit (${maxAllowed}) for the ${level} plan. ` +
            `Please upgrade to a higher plan or wait until next month.`
        );
      }

      // Set featuredAt when turning ON
      await Service.findByIdAndUpdate(
        service._id,
        { 
          isFeatured: true,
          featuredAt: now 
        },
        { new: true, runValidators: true, session }
      );
    } else {
      // Clear featuredAt when turning OFF
      await Service.findByIdAndUpdate(
        service._id,
        { 
          isFeatured: false,
          featuredAt: null 
        },
        { new: true, runValidators: true, session }
      );
    }

    // 7. Fetch updated service
    const updatedService = await Service.findById(id)
      .populate('author category')
      .session(session);

    // 8. Dynamic success message
    const actionMessage = newFeaturedStatus
      ? `Service successfully marked as Featured (${featuredThisMonthCount + 1}/${maxAllowed} this month)`
      : 'Service removed from Featured list';

    await session.commitTransaction();

    return {
      message: actionMessage,
      data: updatedService
    };
  } catch (error) {
    await session.abortTransaction();
    throw error instanceof AppError 
      ? error 
      : new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to toggle featured status');
  } finally {
    session.endSession();
  }
};

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

  //  decrease the category
  await Category.findByIdAndUpdate(
    result.category,
    { $ins: { listingCount: -1 } },
    { new: true },
  )

  return result
}

export const ServiceService = {
  insertIntoDB,
  getAllIntoDB,
  getAllRecommendServices,
  getAIntoDB,
  updateAIntoDB,
  changeStatusFromDB,
  changeFeaturedService,
  deleteAIntoDB,
}
