export const DURATION_TYPE = {
  monthly: 'monthly',
  halfYearly: 'halfYearly',
  annually: 'annually',
} as const

export const PACKAGE_TYPE = {
  verified: 'verified',
  premium: 'premium',
  planner_pro: 'planner_pro',
} as const

export type TDurationType = keyof typeof DURATION_TYPE
export type TPackageType = keyof typeof PACKAGE_TYPE

export const PackageSearchableFields = ['title']
