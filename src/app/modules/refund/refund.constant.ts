export const REFUND_STATUS = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected'
 } as const

 export type TRefundStatus = keyof typeof REFUND_STATUS