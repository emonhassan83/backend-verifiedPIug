export const DURATION_TYPE = {
  monthly: 'monthly',
  annually: 'annually',
} as const

export const AUDIENCE = {
  planer: 'planer',
  vendor: 'vendor',
} as const

export const PACKAGE_TYPE = {
  pro: 'pro',
  elite: 'elite'
} as const

export type TDurationType = keyof typeof DURATION_TYPE
export type TAudience = keyof typeof AUDIENCE
export type TPackageType = keyof typeof PACKAGE_TYPE

export const PackageSearchableFields = ['title']
