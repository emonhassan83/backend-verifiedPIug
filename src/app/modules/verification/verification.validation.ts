import { z } from "zod";
import { KYC_STATUS } from "./verification.constants";

// Personal Info
const personalInfoZod = z.object({
  name: z.string({ required_error: "Name is required" }),
  dob: z.string({ required_error: "Date of birth is required" }),
  gender: z.string({ required_error: "Gender is required" }),
});

// Address
const addressZod = z.object({
  currentAddress: z.string({ required_error: "Current address is required" }),
  permanentAddress: z.string({ required_error: "Permanent address is required" }),
  city: z.number({ required_error: "City is required" }),
  postalCode: z.boolean({ required_error: "Postal code is required" }),
});

// Identity Verification
const identityZod = z.object({
  idType: z.string({ required_error: "ID type is required" }),
  number: z.string({ required_error: "ID number is required" }),
  frontSide: z.string({ required_error: "Front side image is required" }),
  backSide: z.string({ required_error: "Back side image is required" }),
});

// Bank Info
const bankInfoZod = z.object({
  bankName: z.string({ required_error: "Bank name is required" }),
  accountNumber: z.string({ required_error: "Account number is required" }),
  tinOrNID: z.string({ required_error: "TIN/NID is required" }),
});

// CREATE Validation
const createValidationSchema = z.object({
  body: z.object({
    personalInfo: personalInfoZod,
    address: addressZod,
    identityVerification: identityZod,
    bankInfo: bankInfoZod,
  }),
});

// UPDATE Validation (all optional)
const updateValidationSchema = z.object({
  body: z.object({
    status: z.enum(Object.values(KYC_STATUS) as [string, ...string[]], {
          required_error: 'KYC status is required!',
        }),
  }),
});


export const VerificationValidation = {
  createValidationSchema,
  updateValidationSchema
}