import { z } from 'zod'

const createValidationSchema = z.object({
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
})

export const PaystackRecipientValidation = {
  createValidationSchema,
}
