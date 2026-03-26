import { Model, Types } from 'mongoose'
import { TGender, TKycStatus } from './verification.constants'

export interface IPersonalInfo {
  name: string
  dob: string
  gender: TGender
}

export interface IAddress {
  currentAddress: string
  permanentAddress: string
  city: string
  postalCode: string
}

export interface IIdentityVerification {
  idType: string
  number: string
  frontSide: string
  backSide: string
}

export interface IBankInfo {
  accountName: string
  accountNumber: string
  bankCode: string
}

export interface TVerification {
  _id?: string
  user: Types.ObjectId
  personalInfo: IIdentityVerification
  address: IAddress
  identityVerification: IIdentityVerification
  bankInfo: IBankInfo
  status: TKycStatus
}

export type TVerificationModel = Model<TVerification, Record<string, unknown>>
