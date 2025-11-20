export const KYC_STATUS = {
  pending: 'pending',
  approved: 'approved',
  denied: 'denied',
} as const

export const GENDER = {
  male: 'male',
  female: 'female',
  others: 'others',
} as const

export type TKycStatus = keyof typeof KYC_STATUS
export type TGender = keyof typeof GENDER