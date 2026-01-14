import { z } from 'zod'

const createValidationSchema = z.object({
  body: z.object({
    user: z.string({ required_error: 'User ID is required!' }),
    modelType: z.string({ required_error: 'Payment model type is required!' }),
    type: z.string().optional(),
    reference: z.string({ required_error: 'Reference ID is required!' }),
  }),
})

export const PaymentValidation = {
  createValidationSchema
}
