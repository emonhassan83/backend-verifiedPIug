import { z } from 'zod'

const createValidationSchema = z.object({
  body: z.object({
    keyword: z.string({ required_error: 'keyword is required' }),
  }),
})

export const SearchHistoryValidation = {
  createValidationSchema
}
