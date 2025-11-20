export const AUDIENCE = {
  planer: 'planer',
  vendor: 'vendor',
  user: 'user',
} as const

export type TAudience = keyof typeof AUDIENCE