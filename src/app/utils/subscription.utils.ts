import httpStatus from 'http-status'
import { Subscription } from '../modules/subscription/subscription.models'
import {
  PAYMENT_STATUS,
  SUBSCRIPTION_STATUS,
} from '../modules/subscription/subscription.constants'
import AppError from '../errors/AppError'

/**
 * Subscription levels with their allowed features
 */
export const SUBSCRIPTION_FEATURES = {
  starter: {
    name: 'Starter (Free)',
    canUploadPortfolio: false,
    canCreateListings: true,
    analyticsDashboard: false,
    featuredPlacement: 0,
    analyticsLevel: 'basic',
    leadInsights: false,
    teamAccess: false,
  },
  pro: {
    name: 'Pro',
    canUploadPortfolio: true,
    canCreateListings: true,
    analyticsDashboard: true,
    featuredPlacement: 1, // per month
    analyticsLevel: 'full',
    leadInsights: true,
    teamAccess: false,
  },
  elite: {
    name: 'Elite (Planner Pro / Agency)',
    canUploadPortfolio: true,
    canCreateListings: true,
    analyticsDashboard: true,
    featuredPlacement: 3, // per month
    analyticsLevel: 'advanced',
    leadInsights: true,
    teamAccess: true,
  },
} as const

type SubscriptionLevel = keyof typeof SUBSCRIPTION_FEATURES

/**
 * Checks if the user has an active subscription and returns permission details.
 * Throws error if no active subscription or feature not allowed.
 *
 * @param userId - The ID of the user
 * @param feature - The feature to check (e.g., 'canUploadPortfolio')
 * @returns Object with subscription level and feature status
 * @throws AppError if no active subscription or permission denied
 */
export const checkSubscriptionPermission = async (
  userId: string,
  feature: keyof (typeof SUBSCRIPTION_FEATURES)['starter'],
) => {
  // Find active subscription
  const today = new Date()
  const activeSubscription = await Subscription.findOne({
    user: userId,
    paymentStatus: PAYMENT_STATUS.paid,
    status: SUBSCRIPTION_STATUS.active,
    isDeleted: false,
    isExpired: false,
    expiredAt: { $gt: today },
  })
    .populate('package')
    .lean()

  // No active subscription → Starter (Free) level
  if (!activeSubscription) {
    const starterFeatures = SUBSCRIPTION_FEATURES.starter

    if (!starterFeatures[feature]) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `This feature requires a Pro or Elite subscription. Please upgrade your plan.`,
      )
    }

    return {
      level: 'starter' as SubscriptionLevel,
      features: starterFeatures,
      hasAccess: true,
    }
  }

  // Determine subscription level from package or type
  let level: SubscriptionLevel

  // `package` may be an ObjectId until populated, so cast to an object
  // with an optional `type` field before using it.
  const pkg = activeSubscription.package as { type?: string } | undefined

  // You can map this based on your Package model or subscription type
  // Example logic (adjust according to your Package model)
  const pkgType = pkg?.type?.toLowerCase()
  if (pkgType?.includes('elite')) {
    level = 'elite'
  } else if (pkgType?.includes('pro')) {
    level = 'pro'
  } else {
    level = 'starter'
  }

  const features = SUBSCRIPTION_FEATURES[level]

  if (!features[feature]) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `The "${feature}" feature is only available in ${features.name} or higher plans. Please upgrade.`,
    )
  }

  return {
    level,
    features,
    hasAccess: true,
    subscription: activeSubscription,
  }
}
