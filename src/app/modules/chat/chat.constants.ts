export const CHAT_TYPE = {
  private: 'private',
  group: 'group'
} as const

export const CHAT_STATUS = {
  accepted: 'accepted',
  paused: 'paused',
  blocked: 'blocked',
  archived: 'archived'
} as const

export type TChatType = keyof typeof CHAT_TYPE
export type TChatStatus = keyof typeof CHAT_STATUS