import { z } from 'zod'

const createValidationSchema = z.object({
  body: z.object({
    category: z.string({ required_error: 'Category ID is required' }),
    title: z.string({ required_error: 'Title is required' }),
    subtitle: z.string({ required_error: 'Subtitle is required' }),
    description: z.string({ required_error: 'Description is required' })
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    images: z.array(z.string()).optional()
  }),
})

export const CategoryValidation = {
  createValidationSchema,
  updateValidationSchema,
}
