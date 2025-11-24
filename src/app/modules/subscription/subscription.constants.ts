export const SUBSCRIPTION_TYPE = {
  verified: 'verified',
  premium: 'premium',
  planner_pro: 'planner_pro',
} as const

export const SUBSCRIPTION_STATUS = {
  pending: 'pending',
  active: 'active',
  cancelled: 'cancelled',
} as const

export const PAYMENT_STATUS = {
  unpaid: 'unpaid',
  paid: 'paid',
  failed: 'failed',
} as const

export const RENEW_STATUS = {
  active: 'active',
  disabled: 'disabled'
} as const

export type TSubscriptionType = keyof typeof SUBSCRIPTION_TYPE
export type TSubscriptionStatus = keyof typeof SUBSCRIPTION_STATUS
export type TPaymentStatus = keyof typeof PAYMENT_STATUS
export type TRenewStatus = keyof typeof RENEW_STATUS
