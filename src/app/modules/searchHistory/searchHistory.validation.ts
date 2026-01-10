import { z } from 'zod'

const objectIdValidation = z
  .string({
    required_error: 'ObjectId is required',
  })
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

// Create Validation
const createValidationSchema = z.object({
  body: z.object({
    modelType: z.string({
      required_error: "Search modelType is required!"
    }),
    refId: objectIdValidation,
  }),
});

export const SearchHistoryValidation = {
  createValidationSchema
};
