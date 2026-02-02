export const PARTICIPANT_ROLE = {
  user: 'user',
  vendor: 'vendor',
  planer: 'planer',
} as const

export const PARTICIPANT_STATUS = {
  active: 'active',
  blocked: 'blocked',
} as const

export type TParticipantRole = keyof typeof PARTICIPANT_ROLE
export type TParticipantStatus = keyof typeof PARTICIPANT_STATUS
