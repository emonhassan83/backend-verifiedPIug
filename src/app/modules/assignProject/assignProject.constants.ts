export const VENDOR_ASSIGNMENT_STATUS = {
  assigned: 'assigned',       
  inProgress: 'inProgress', 
  completed: 'completed',   
  cancelled: 'cancelled'
} as const;

export const ASSIGNMENT_PAYMENT_STATUS = {
  pending: 'pending',       
  partial: 'partial', 
  paid: 'paid',   
  refound: 'refound'
} as const;

export type TVendorAssignmentStatus = keyof typeof VENDOR_ASSIGNMENT_STATUS
export type TAssignmentPaymentStatus = keyof typeof ASSIGNMENT_PAYMENT_STATUS