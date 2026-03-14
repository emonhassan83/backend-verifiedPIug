import { z } from 'zod'
import { CHAT_STATUS } from './chat.constants'
import { Types } from 'mongoose';
import { modelType } from './chat.interface';

const objectIdSchema = z.string().refine(val => Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
});

const createValidation = z.object({
  body: z.object({
    modelType: z.enum(Object.values(modelType) as [string, ...string[]], {
      required_error: 'Chat type is required!',
    }),
    participants: z.array(
      objectIdSchema
        .refine(val => Types.ObjectId.isValid(val), {
          message: 'Invalid participant ObjectId',
        })
        .optional(),
    ),
  }),
})

const updateValidation = z.object({
  body: z.object({
    name: z
      .string({
        required_error: 'Chat name is required!',
      })
      .optional(),
    image: z
      .string({
        required_error: 'Chat image is required!',
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
