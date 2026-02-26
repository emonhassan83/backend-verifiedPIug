import httpStatus from 'http-status'
import { TReviews } from './review.interface'
import QueryBuilder from '../../builder/QueryBuilder'
import mongoose, { ClientSession } from 'mongoose'
import { Reviews } from './review.models'
import AppError from '../../errors/AppError'
import { User } from '../user/user.model'
import { Order } from '../order/order.models'

const createReviews = async (
  payload: TReviews,
  userId: string, // logged-in reviewer
) => {
  const session: ClientSession = await mongoose.startSession()
  session.startTransaction()

  try {
    const { order: orderId, author: authorId } = payload

    /* ------------------ 1. Validate Order ------------------ */
    const order = await Order.findById(orderId).session(session)
    if (!order || order.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'Order not found')
    }

    /* ------------------ 2. Validate Reviewer ------------------ */
    const reviewer = await User.findById(userId).session(session)
    if (!reviewer || reviewer.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'Reviewer not found')
    }

    /* ------------------ 3. Validate Author ------------------ */
    const author = await User.findById(authorId).session(session)
    if (!author || author.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'Author not found')
    }

    /* ------------------ 4. Business Rules ------------------ */

    // Reviewer cannot review himself
    if (userId === authorId.toString()) {
      throw new AppError(httpStatus.BAD_REQUEST, 'You cannot review yourself')
    }

    // Order already reviewed check
    const alreadyReviewed = await Reviews.findOne({
      order: orderId,
      user: userId,
    }).session(session)

    if (alreadyReviewed) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'This order is already reviewed',
      )
    }

    const { communicationSkills, professionalism, serviceQuality } =
      payload.ratings

    const overallRating =
      (communicationSkills + professionalism + serviceQuality) / 3

    /* ------------------ 5. Create Review ------------------ */
    const reviewPayload = {
      ...payload,
      user: userId, // enforce reviewer
      overallRating: Number(overallRating.toFixed(1))
    }

    const [createdReview] = await Reviews.create([reviewPayload], {
      session,
    })
    if (!createdReview) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create review')
    }

    /* ------------------ 6. Update Author Rating ------------------ */
    const oldAvg = author.avgRating || 0
    const oldCount = author.ratingCount || 0

    const newRatingCount = oldCount + 1
    const newAvgRating = (oldAvg * oldCount + overallRating) / newRatingCount

    await User.findByIdAndUpdate(
      authorId,
      {
        avgRating: Number(newAvgRating.toFixed(2)),
        ratingCount: newRatingCount,
      },
      { session },
    )

    /* ------------------ 7. Commit Transaction ------------------ */
    await session.commitTransaction()
    session.endSession()

    return createdReview
  } catch (error: any) {
    await session.abortTransaction()
    session.endSession()

    throw new AppError(
      httpStatus.BAD_REQUEST,
      error?.message || 'Review creation failed',
    )
  }
}

const getAllReviews = async (query: Record<string, any>) => {
  const reviewsModel = new QueryBuilder(
    Reviews.find()
      .populate([{ path: 'user', select: 'name photoUrl' }])
      .select('user author review overallRating createdAt'),
    query
  )
    .search(['review'])
    .filter()
    .sort()
    .paginate()
    .fields();

  // 1. Paginated reviews
  const reviews = await reviewsModel.modelQuery.lean();

  // 2. Total meta
  const meta = await reviewsModel.countTotal();

  // 3. Rating breakdown
  const ratingBreakdown = await Reviews.aggregate([
    {
      $match: reviewsModel.modelQuery.getFilter()
    },
    {
      $group: {
        _id: '$overallRating',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        rating: '$_id',
        count: 1,
      },
    },
  ]);

  // 4. create a count map for ratings
  const countMap = {
    excellent: 0, // 5.0
    veryGood: 0,  // 4.0 - 4.9
    good: 0,      // 3.0 - 3.9
    fair: 0,      // 2.0 - 2.9
    poor: 0,      // 1.0 - 1.9
  };

  ratingBreakdown.forEach((item) => {
    const rating = Math.floor(item.rating); // 4.7 → 4
    if (rating === 5) countMap.excellent = item.count;
    else if (rating === 4) countMap.veryGood += item.count;
    else if (rating === 3) countMap.good += item.count;
    else if (rating === 2) countMap.fair += item.count;
    else if (rating === 1) countMap.poor += item.count;
  });

  return {
    meta,
    data: {
      ratingBreakdown: countMap,
      reviews,
    },
  };
};

const getReviewsById = async (id: string) => {
  const result = await Reviews.findById(id).populate([
    { path: 'order' },
    { path: 'user', select: 'name photoUrl' },
  ])
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Reviews not found!')
  }
  return result
}

const updateReviews = async (id: string, payload: Partial<TReviews>) => {
  const result = await Reviews.findByIdAndUpdate(id, payload, { new: true })
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to update Reviews')
  }
  return result
}

const deleteReviews = async (id: string) => {
  const result = await Reviews.findByIdAndDelete(id)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to delete Reviews')
  }

  return result
}

export const reviewsService = {
  createReviews,
  getAllReviews,
  getReviewsById,
  updateReviews,
  deleteReviews,
}
