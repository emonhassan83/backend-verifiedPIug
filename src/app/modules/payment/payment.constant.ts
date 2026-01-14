export const PAYMENT_STATUS = {
  unpaid: 'unpaid',
  completed: 'completed',
  paid: 'paid',
  failed: 'failed',
  refunded: 'refunded',
} as const

export const PAYMENT_TYPE = {
  initial: 'initial',
  final: 'final',
  full: 'full',
} as const

export type TPaymentStatus = keyof typeof PAYMENT_STATUS
export type TPaymentType = keyof typeof PAYMENT_TYPE
