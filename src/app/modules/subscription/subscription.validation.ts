import { Types } from 'mongoose'
import { z } from 'zod'

const createValidationSchema = z.object({
  body: z.object({
    user: z.string().refine((val) => Types.ObjectId.isValid(val), {
      message: 'Invalid user ID',
    }),
    package: z.string().refine((val) => Types.ObjectId.isValid(val), {
      message: 'Invalid package ID',
    }),
  }),
})

export const subscriptionValidation = {
  createValidationSchema,
}
