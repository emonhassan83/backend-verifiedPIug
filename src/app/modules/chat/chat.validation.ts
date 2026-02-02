import { z } from 'zod'
import { CHAT_STATUS } from './chat.constants'

const createValidation = z.object({
  body: z.object({
    type: z.enum(Object.values(CHAT_STATUS) as [string, ...string[]], {
      required_error: 'Chat type is required!',
    }),
    name: z
      .string({
        required_error: 'Chat name is required!',
      })
      .optional(),
  }),
})

const updateValidation = z.object({
  body: z.object({
    name: z
      .string({
        required_error: 'Chat name is required!',
      })
      .optional(),
  }),
})

const changeStatusValidation = z.object({
  body: z.object({
    status: z.enum(Object.values(CHAT_STATUS) as [string, ...string[]], {
      required_error: 'Chat status is required!',
    }),
  }),
})

export const ChatValidation = {
  createValidation,
  updateValidation,
  changeStatusValidation,
}
