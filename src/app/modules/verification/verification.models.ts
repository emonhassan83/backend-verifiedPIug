import { Schema, model } from 'mongoose'
import { TVerification, TVerificationModel } from './verification.interface'
import { KYC_STATUS } from './verification.constants'

const personalInfoSchema = new Schema(
  {
    name: { type: String, required: true },
    dob: { type: String, required: true },
    gender: { type: String, required: true },
  },
  { _id: false },
)

const addressSchema = new Schema(
  {
    currentAddress: { type: String, required: true },
    permanentAddress: { type: String, required: true },
    city: { type: Number, required: true },
    postalCode: { type: Boolean, required: true },
  },
  { _id: false },
)

const identityVerificationSchema = new Schema(
  {
    idType: { type: String, required: true },
    number: { type: String, required: true },
    frontSide: { type: String, required: true },
    backSide: { type: String, required: true },
  },
  { _id: false },
)

const bankInfoSchema = new Schema(
  {
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    tinOrNID: { type: String, required: true },
  },
  { _id: false },
)

const verificationSchema = new Schema<TVerification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    personalInfo: {
      type: personalInfoSchema,
      required: true,
    },
    address: {
      type: addressSchema,
      required: true,
    },
    identityVerification: {
      type: identityVerificationSchema,
      required: true,
    },
    bankInfo: {
      type: bankInfoSchema,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(KYC_STATUS),
      default: KYC_STATUS.pending,
    },
  },
  { timestamps: true },
)

export const Verification = model<TVerification, TVerificationModel>(
  'Verification',
  verificationSchema,
)
