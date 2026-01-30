import { Types } from 'mongoose'
import { z } from 'zod'
import { VENDOR_ASSIGNMENT_STATUS } from './assignProject.constants'

const objectIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
})

const createValidationSchema = z.object({
  body: z.object({
    // Required References (ObjectId as string)
    project: objectIdSchema,
    vendor: objectIdSchema,
    vendorOrder: objectIdSchema,

    // Service Information
    serviceType: z
      .array(
        z.string({
          required_error: 'Service type is required',
        }),
      )
      .nonempty('At least one service type is required'),
    serviceDescription: z.string().optional(),

    // Dates
    deadline: z
      .string({
        required_error: 'Deadline is required',
      })
      .refine((date) => !isNaN(Date.parse(date)), {
        message: 'Invalid deadline date format',
      })
      .optional(),

    // Status & Notes
    notes: z.string().optional(),
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    // Optional updates for all fields
    serviceType: z.array(z.string()).optional(),
    serviceDescription: z.string().optional(),

    agreedAmount: z
      .number()
      .positive('Agreed amount must be positive')
      .optional(),
    paidAmount: z.number().min(0, 'Paid amount cannot be negative').optional(),

    deadline: z
      .string()
      .refine((date) => !isNaN(Date.parse(date)), {
        message: 'Invalid deadline date format',
      })
      .optional(),
    startDate: z
      .string()
      .refine((date) => (date ? !isNaN(Date.parse(date)) : true), {
        message: 'Invalid start date format',
      })
      .optional(),
    completedDate: z
      .string()
      .refine((date) => (date ? !isNaN(Date.parse(date)) : true), {
        message: 'Invalid completed date format',
      })
      .optional(),

    notes: z.string().optional(),
  }),
})

const changeStatusValidationSchema = z.object({
  body: z.object({
    status: z.enum(
      Object.keys(VENDOR_ASSIGNMENT_STATUS) as [string, ...string[]],
      {
        required_error: 'Assign vendor status is required',
      },
    ),
  }),
})

export const AssignProjectValidation = {
  createValidationSchema,
  updateValidationSchema,
  changeStatusValidationSchema,
}
