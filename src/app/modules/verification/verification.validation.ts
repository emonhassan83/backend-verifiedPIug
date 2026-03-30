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
  city: z.string({ required_error: "City is required" }),
  postalCode: z.string({ required_error: "Postal code is required" }),
});

// Identity Verification
const identityZod = z.object({
  idType: z.string({ required_error: "ID type is required" }),
  number: z.string({ required_error: "ID number is required" })
});

// Bank Info
const bankInfoZod = z.object({
  body: z.object({
    accountNumber: z
      .string({
        required_error: 'Account number is required!',
      })
      .min(10, 'Account number must be at least 10 digits')
      .max(10, 'Account number must be exactly 10 digits')
      .regex(/^\d+$/, 'Account number must contain only digits'),

    bankCode: z
      .string({
        required_error: 'Bank code is required!',
      })
      .min(3, 'Bank code must be exactly 3 digits')
      .max(3, 'Bank code must be exactly 3 digits')
      .regex(/^\d+$/, 'Bank code must contain only digits'),

    accountName: z
      .string({
        required_error: 'Account name is required!',
      })
      .min(2, 'Account name must be at least 2 characters')
      .max(100, 'Account name is too long')
      .trim(),
  }),
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