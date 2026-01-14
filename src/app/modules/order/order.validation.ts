import { z } from 'zod'
import { ORDER_STATUS } from './order.constants'

const createValidationSchema = z.object({
  body: z.object({
    receiver: z.string({ required_error: 'Receiver ID is required' }),
    title: z.string({ required_error: 'Title is required' }).min(3),
    type: z.string({ required_error: 'Order type is required' }).min(3),
    shortDescription: z
      .string({ required_error: 'Short description is required' })
      .min(10),
    description: z
      .string({ required_error: 'Description is required' })
      .min(20),
    duration: z.number({ required_error: 'Duration is required' }).positive(),
    totalAmount: z
      .number({ required_error: 'Total amount is required' })
      .positive(),
    startDate: z.string({ required_error: 'Start date is required' }),
    longitude: z.number({
      required_error: 'longitude is required!',
    }),
    latitude: z.number({
      required_error: 'latitude is required!',
    }),
    address: z.string({ required_error: 'Address is required' }),
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(100).optional(),
    type: z.string().min(3).optional(),
    shortDescription: z.string().min(10).max(200).optional(),
    description: z.string().min(20).optional(),
    duration: z.number().positive().optional(),
    totalAmount: z.number().positive().optional(),
    finalAmount: z.number().positive().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    actualStartDate: z.string().optional(),
    actualEndDate: z.string().optional(),
    longitude: z.number().optional(),
    latitude: z.number().optional(),
    address: z.string().optional(),
  }),
})

const changeStatusValidationSchema = z.object({
  body: z.object({
    status: z.enum(Object.keys(ORDER_STATUS) as [string, ...string[]], {
      required_error: 'Order status is required',
    }),
  }),
})

// Optional: Payment status update validation
const paymentValidationSchema = z.object({
  body: z.object({
    paymentType: z.enum(['initial', 'final']),
    amountPaid: z.number().positive().optional(),
  }),
})

export const OrderValidation = {
  createValidationSchema,
  updateValidationSchema,
  changeStatusValidationSchema,
  paymentValidationSchema,
}
