import { z } from 'zod'

const ratingsSchema = z.object({
  communicationSkills: z
    .number({
      required_error: "Communication skills rating is required",
      invalid_type_error: "Communication skills rating must be a number",
    })
    .min(1, "Communication skills must be at least 1 star")
    .max(5, "Communication skills cannot exceed 5 stars"),

  professionalism: z
    .number({
      required_error: "Professionalism rating is required",
      invalid_type_error: "Professionalism rating must be a number",
    })
    .min(1, "Professionalism must be at least 1 star")
    .max(5, "Professionalism cannot exceed 5 stars"),

  serviceQuality: z
    .number({
      required_error: "Service quality rating is required",
      invalid_type_error: "Service quality rating must be a number",
    })
    .min(1, "Service quality must be at least 1 star")
    .max(5, "Service quality cannot exceed 5 stars"),
});


const createValidationSchema = z.object({
  body: z.object({
    order: z.string({
      required_error: "Order ID is required",
    }),
    ratings: ratingsSchema,
    reactions: z
      .string({
        invalid_type_error: "Reactions must be a string",
      }),
    review: z.string({
      required_error: "Review text is required",
    }),
  }),
});

const updateValidationSchema = z.object({
  body: z.object({
   reactions: z
      .string({
        invalid_type_error: "Reactions must be a string",
      }).optional(),
    review: z.string({
      required_error: "Review text is required",
    }).optional(),
  }),
})

export const ReviewsValidation = {
  createValidationSchema,
  updateValidationSchema,
}
