import { z } from 'zod'

const createValidationSchema = z.object({
  body: z.object({
     project: z.string({
      required_error: "Project ID is required",
    }),
    vendor: z.string({
      required_error: "Vendor ID is required",
    }),
    vendorName: z.string({
      required_error: "Vendor name is required",
    }),
    vendorCategory: z.string({
      required_error: "Vendor category is required",
    }),
    vendorEmail: z
      .string({
        required_error: "Vendor email is required",
      })
      .email("Invalid email format"),
    vendorPhone: z.string({
      required_error: "Vendor phone number is required",
    }),
    quote: z.number({
      required_error: "Quote amount is required",
    }),
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    vendorName: z.string().optional(),
    vendorCategory: z.string().optional(),
    vendorEmail: z.string().email().optional(),
    vendorPhone: z.string().optional(),
    quote: z.number().optional(),
  }),
})

export const AssignProjectValidation = {
  createValidationSchema,
  updateValidationSchema,
}
