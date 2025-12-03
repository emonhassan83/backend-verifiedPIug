import { z } from 'zod'
import { USER_STATUS } from './user.constant'

const socialProfilesZodSchema = z
  .object({
    instagram: z.string().url().optional().nullable(),
    linkedin: z.string().url().optional().nullable(),
    website: z.string().url().optional().nullable(),
  })
  .optional()

// Define the Zod validation schema
const createValidationSchema = z.object({
  body: z.object({
    name: z.string({
      required_error: 'User name is required!',
    }),
    email: z.string({
      required_error: 'Email is required!',
    }),
    password: z
      .string({
        invalid_type_error: 'Password must be a string',
      })
      .min(6, { message: 'Password must be at least 6 characters' })
      .max(16, { message: 'Password cannot be more than 16 characters' }),
    confirmPassword: z
      .string({
        invalid_type_error: 'Password must be a string',
      })
      .min(6, { message: 'Password must be at least 6 characters' })
      .max(16, { message: 'Password cannot be more than 16 characters' }),
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    name: z
      .string({
        required_error: 'User name is required!',
      })
      .optional(),
    contractNumber: z
      .string({
        required_error: 'contractNumber is required!',
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
    address: z
      .string({
        required_error: 'address is required!',
      })
      .optional(),
    bio: z
      .string({
        required_error: 'Bio is required!',
      })
      .optional(),
    categories: z
      .array(
        z.string({
          required_error: 'categoryIds is required!',
        }),
      )
      .optional(),
    socialProfiles: socialProfilesZodSchema,
  }),
})

const changeStatusValidationSchema = z.object({
  body: z.object({
    userId: z.string({
      required_error: 'User id is required!',
    }),
    status: z.enum(Object.values(USER_STATUS) as [string, ...string[]], {
      required_error: 'User status is required!',
    }),
  }),
})

const updateLocationValidationSchema = z.object({
  body: z.object({
    longitude: z.number({
      required_error: 'longitude is required!',
    }),
    latitude: z.number({
      required_error: 'latitude is required!',
    }),
  }),
})

export const UserValidation = {
  createValidationSchema,
  updateValidationSchema,
  changeStatusValidationSchema,
  updateLocationValidationSchema,
}
