export const WITHDRAW_AUTHORITY = {
  planer: 'planer',
  vendor: 'vendor'
} as const

export const WITHDRAW_METHOD = {
  bank: 'bank',
  playstack: 'playstack'
} as const

export const WITHDRAW_STATUS = {
  proceed: 'proceed',
  completed: 'completed',
  hold: 'hold',
  pending: 'pending',
  failed: 'failed',
} as const

export type TWithdrawAuthority = keyof typeof WITHDRAW_AUTHORITY
export type TWithdrawMethod = keyof typeof WITHDRAW_METHOD
export type TWithdrawStatus = keyof typeof WITHDRAW_STATUS
