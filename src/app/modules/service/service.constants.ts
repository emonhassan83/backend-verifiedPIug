export const SERVICE_AUTHORITY = {
  planer: 'planer',
  vendor: 'vendor',
} as const

export const SERVICE_STATUS = {
  pending: 'pending',
  active: 'active',
  denied: 'denied',
} as const

export const PRICE_TYPE = {
  fixed: 'fixed',
  starting_from: 'starting_from',
  request_quote: 'request_quote',
  // per_day: 'per_day',
  // per_event: 'per_event',
  // per_unit: 'per_unit',
  // package: 'package',
  // custom: 'custom',
} as const

export type TServiceAuthority = keyof typeof SERVICE_AUTHORITY
export type TPriceType = keyof typeof PRICE_TYPE
export type TServiceStatus = keyof typeof SERVICE_STATUS
