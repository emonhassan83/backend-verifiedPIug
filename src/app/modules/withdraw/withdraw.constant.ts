export const WITHDRAW_METHOD = {
  bank: 'bank',
  playstack: 'playstack'
} as const

export const WITHDRAW_STATUS = {
  pending: 'pending',
  approved: 'approved',
  cancelled: 'cancelled',
  paid: 'paid',
} as const

export type TWithdrawMethod = keyof typeof WITHDRAW_METHOD
export type TWithdrawStatus = keyof typeof WITHDRAW_STATUS
