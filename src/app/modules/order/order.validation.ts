import { z } from 'zod'
import { DURATION_TYPE, ORDER_STATUS, ORDER_TYPE } from './order.constants'

const createValidationSchema = z.object({
  body: z.object({
     author: z.string({ required_error: "Author ID is required" }),
    receiver: z.string({ required_error: "Receiver ID is required" }),
    project: z.string({ required_error: "Project ID is required" }),

    title: z.string({ required_error: "Title is required" }),
    type: z.enum(Object.keys(ORDER_TYPE) as [string, ...string[]], {
      required_error: "Order type is required",
    }),

    description: z.string({ required_error: "Description is required" }),

    duration: z.number({ required_error: "Duration is required" }),
    durationType: z.enum(
      Object.keys(DURATION_TYPE) as [string, ...string[]],
      {
        required_error: "Duration type is required",
      }
    ),

    amount: z.number({ required_error: "Amount is required" }),

    startDate: z.string({ required_error: "Start date is required" }),
    endDate: z.string({ required_error: "End date is required" }),

    location: z.string({ required_error: "Location is required" }),
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    type: z.enum(Object.keys(ORDER_TYPE) as [string, ...string[]]).optional(),
    description: z.string().optional(),

    duration: z.number().optional(),
    durationType: z
      .enum(Object.keys(DURATION_TYPE) as [string, ...string[]])
      .optional(),

    amount: z.number().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    location: z.string().optional(),
})
});

const changeStatusValidationSchema = z.object({
  body: z.object({
      status: z.enum(Object.keys(ORDER_STATUS) as [string, ...string[]], {
      required_error: "Order status is required!",
    }),
  }),
})

export const OrderValidation = {
  createValidationSchema,
  updateValidationSchema,
  changeStatusValidationSchema
}
