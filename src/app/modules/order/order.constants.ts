export const ORDER_STATUS = {
  pending: 'pending',
  running: 'running',
  completed: 'completed',
  cancelled: 'cancelled',
  denied: 'denied',
  refunded: 'refunded',
} as const

export const PAYMENT_STATUS = {
  pending: 'pending',
  completed: 'completed',
  failed: 'failed',
  refunded: 'refunded',
} as const

export const ORDER_AUTHORITY = {
  planer: 'planer',
  vendor: 'vendor',
} as const

export type TOrderAuthority = keyof typeof ORDER_AUTHORITY
export type TOrderStatus = keyof typeof ORDER_STATUS
export type TPaymentStatus = keyof typeof PAYMENT_STATUS
