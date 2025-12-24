import { z } from 'zod'
import { PRICE_TYPE, SERVICE_STATUS } from './service.constants'

const createValidationSchema = z.object({
  body: z.object({
    category: z.string({ required_error: 'Category ID is required' }),
    title: z.string({ required_error: 'Title is required' }),
    subtitle: z.string({ required_error: 'Subtitle is required' }),
    longitude: z.number({
      required_error: 'longitude is required!',
    }),
    latitude: z.number({
      required_error: 'latitude is required!',
    }),
    address: z.string({
      required_error: 'address is required!',
    }),
    description: z.string({ required_error: 'Description is required' }),
    price: z.number({ required_error: 'Description is required' }),
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
    address: z
      .string({
        required_error: 'address is required!',
      })
      .optional(),
    longitude: z
      .number({
        required_error: 'longitude is required!',
      })
      .optional(),
    latitude: z
      .number({
        required_error: 'latitude is required!',
      })
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
