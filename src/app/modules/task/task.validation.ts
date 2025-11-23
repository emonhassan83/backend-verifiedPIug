import { z } from 'zod'

const createValidationSchema = z.object({
  body: z.object({
     project: z.string({
      required_error: "Project ID is required",
    }),
    title: z.string({
      required_error: "Task title is required",
    }),
    date: z.string({
      required_error: "Task date is required",
    }),
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    date: z.string().optional(),
  }),
})

export const TaskValidation  = {
  createValidationSchema,
  updateValidationSchema,
}
