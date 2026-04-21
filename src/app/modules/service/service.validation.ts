import { z } from 'zod'
import { PRICE_TYPE, SERVICE_STATUS } from './service.constants'

// List of valid South African provinces
const SA_PROVINCES = [
  'Gauteng',
  'Western Cape',
  'KwaZulu-Natal',
  'Eastern Cape',
  'Mpumalanga',
  'Limpopo',
  'North West',
  'Free State',
  'Northern Cape',
] as const

const createValidationSchema = z.object({
  body: z.object({
    category: z.string({ required_error: 'Category ID is required' }),
    title: z.string({ required_error: 'Title is required' }),
    subtitle: z.string({ required_error: 'Subtitle is required' }),
    description: z.string({ required_error: 'Description is required' }),
    price: z.number({ required_error: 'Description is required' }),

    // Service Areas (NEW) - Array of province names
    serviceAreas: z
      .array(
        z.object({
          name: z.enum(SA_PROVINCES, {
            required_error: 'Province name is required',
            invalid_type_error: `Province must be one of: ${SA_PROVINCES.join(', ')}`,
          }),
        }),
      )
      .min(1, 'At least one service area is required')
      .max(10, 'Maximum 10 service areas allowed'),

    priceType: z.enum(Object.values(PRICE_TYPE) as [string, ...string[]], {
      required_error: 'Price type is required!',
    }),
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    title: z.string({ required_error: 'Title is required' }).optional(),
    subtitle: z.string({ required_error: 'Subtitle is required' }).optional(),
    description: z
      .string({ required_error: 'Description is required' })
      .optional(),

    // Service Areas (optional update)
    serviceAreas: z
      .array(
        z.object({
          name: z.enum(SA_PROVINCES, {
            invalid_type_error: `Province must be one of: ${SA_PROVINCES.join(', ')}`,
          }),
        }),
      )
      .min(1, 'At least one service area is required')
      .max(10, 'Maximum 10 service areas allowed')
      .optional(),

    price: z.number({ required_error: 'Description is required' }).optional(),
    priceType: z
      .enum(Object.values(PRICE_TYPE) as [string, ...string[]], {
        required_error: 'Price type is required!',
      })
      .optional(),
  }),
})

const changeStatusValidationSchema = z.object({
  body: z.object({
    status: z.enum(Object.values(SERVICE_STATUS) as [string, ...string[]], {
      required_error: 'Service status is required!',
    }),
  }),
})

export const ServiceValidation = {
  createValidationSchema,
  updateValidationSchema,
  changeStatusValidationSchema,
}
