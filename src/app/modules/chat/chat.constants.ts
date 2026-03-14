export const CHAT_STATUS = {
  active: 'active',
  locked: 'locked',
  blocked: 'blocked',
  archived: 'archived'
} as const

export type TChatStatus = keyof typeof CHAT_STATUS