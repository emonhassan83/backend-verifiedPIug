export const PROJECT_STATUS = {
  pending: 'pending',
  ongoing: 'ongoing',
  completed: 'completed',
  cancelled: 'cancelled',
  refunded: 'refunded',
} as const

export type TProjectStatus = keyof typeof PROJECT_STATUS
