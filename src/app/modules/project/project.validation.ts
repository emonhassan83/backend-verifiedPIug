import { z } from 'zod'
import { PROJECT_STATUS } from './project.constants'

const createValidationSchema = z.object({
  body: z.object({
    order: z.string({
      required_error: 'Order Id is required!',
    }),
  }),
})

const changeStatusValidationSchema = z.object({
  body: z.object({
    status: z.enum(Object.keys(PROJECT_STATUS) as [string, ...string[]], {
      required_error: 'Project status is required!',
    }),
  }),
})

export const ProjectValidation = {
  createValidationSchema,
  changeStatusValidationSchema,
}
