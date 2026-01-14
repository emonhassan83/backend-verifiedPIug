export const REFUND_STATUS = {
  pending: 'pending',
  confirmed: 'confirmed',
  rejected: 'rejected'
 } as const

 export const REFUND_AUTHORITY = {
   planer: 'planer',
   user: 'user',
 } as const

 export type TRefundStatus = keyof typeof REFUND_STATUS
 export type TRefundAuthority = keyof typeof REFUND_AUTHORITY