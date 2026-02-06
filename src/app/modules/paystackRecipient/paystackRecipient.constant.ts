export const RECIPIENT_STATUS = {
  pending: 'pending',
  verified: 'verified',
  rejected: 'rejected',
  deactivated: 'deactivated',
} as const;

export type TRecipientStatus = keyof typeof RECIPIENT_STATUS;