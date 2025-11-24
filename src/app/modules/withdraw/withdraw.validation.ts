import { z } from 'zod'
import { WITHDRAW_METHOD, WITHDRAW_STATUS } from './withdraw.constant'

const createValidationSchema = z.object({
  body: z.object({
    method: z.enum(Object.values(WITHDRAW_METHOD) as [string, ...string[]], {
      required_error: 'Withdraw method is required!',
    }),
    amount: z.number({
      required_error: 'Withdraw amount is required',
    }),
  }),
})

const changeStatusValidationSchema = z.object({
  body: z.object({
    status: z.enum(Object.values(WITHDRAW_STATUS) as [string, ...string[]], {
      required_error: 'Withdraw status is required!',
    }),
  }),
})

export const WithdrawValidation = {
  createValidationSchema,
  changeStatusValidationSchema
}
