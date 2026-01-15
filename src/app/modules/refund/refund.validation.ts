import { z } from 'zod'

const createValidationSchema = z.object({
  body: z.object({
    order: z.string({ required_error: 'Order ID is required' }),
    reason: z.string().min(3, 'Reason must be at least 3 characters'),
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .min(3, 'Reason must be at least 3 characters')
      .optional(),
  }),
})

export const RefundValidation = {
  createValidationSchema,
  updateValidationSchema,
}
