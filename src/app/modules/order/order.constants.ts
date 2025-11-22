export const ORDER_STATUS = {
  pending: 'pending',
  active: 'active',
  completed: 'completed',
  cancelled: 'cancelled',
  denied: 'denied',
} as const

export const ORDER_TYPE = {
  planner: 'planner',
  vendor: 'vendor',
} as const

export const DURATION_TYPE = {
  per_hour: 'per_hour',
  per_days: 'per_days',
} as const

export type TDurationType = keyof typeof DURATION_TYPE
export type TOrderType = keyof typeof ORDER_TYPE
export type TOrderStatus = keyof typeof ORDER_STATUS
