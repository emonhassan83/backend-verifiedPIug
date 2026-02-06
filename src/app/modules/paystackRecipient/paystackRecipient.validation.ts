import { z } from 'zod'

const createValidationSchema = z.object({
  body: z.object({
    accountNumber: z.string({
      required_error: 'Account number is required!',
    }),
    bankCode: z.string({
      required_error: 'Bank code is required',
    }),
    accountName: z.string({
      required_error: 'Account number is required',
    }),
  }),
})

export const PaystackRecipientValidation = {
  createValidationSchema,
}
