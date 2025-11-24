import { z } from 'zod'
import { DURATION_TYPE, PACKAGE_TYPE } from './package.constant'

const createValidationSchema = z.object({
  body: z.object({
    title: z
      .string({
        required_error: 'Package title is required!',
      })
      .min(5)
      .max(255),
    type: z.enum(Object.values(PACKAGE_TYPE) as [string, ...string[]], {
      required_error: 'Package type is required!',
    }),
    billingCycle: z.enum(
      Object.values(DURATION_TYPE) as [string, ...string[]],
      {
        required_error: 'Package billing type is required!',
      },
    ),
    description: z
      .array(z.string().min(1))
      .min(1, { message: 'At least one description point is required!' }),
    price: z
      .number()
      .int('Price must be an integer')
      .min(0, 'Price must be a positive number'),
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Package title is required').optional(),
    type: z.enum(Object.values(PACKAGE_TYPE) as [string, ...string[]], {
      required_error: 'Package type is required!',
    }).optional(),
    billingCycle: z.enum(
      Object.values(DURATION_TYPE) as [string, ...string[]],
      {
        required_error: 'Package billing type is required!',
      },
    ).optional(),
    description: z
      .array(z.string().min(1))
      .min(1, { message: 'At least one description point is required!' })
      .optional(),
    price: z.number().min(0, 'Price must be a positive number').optional(),
  }),
})

export const PackageValidation = {
  createValidationSchema,
  updateValidationSchema,
}
