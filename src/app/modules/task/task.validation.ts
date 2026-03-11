import { Types } from 'mongoose'
import { z } from 'zod'

const objectIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId format',
})

const createValidationSchema = z.object({
  body: z.object({
    project: objectIdSchema,
    title: z.string({
      required_error: 'Task title is required',
    }),
    date: z.string({
      required_error: 'Task date is required',
    }),
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    date: z.string().optional(),
  }),
})

export const TaskValidation = {
  createValidationSchema,
  updateValidationSchema,
}
