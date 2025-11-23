export const PROJECT_STATUS = {
  pending: 'pending',
  ongoing: 'ongoing',
  completed: 'completed',
  cancelled: 'cancelled',
} as const

export type TProjectStatus = keyof typeof PROJECT_STATUS
