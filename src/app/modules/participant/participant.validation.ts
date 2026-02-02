import { z } from 'zod'
import { PARTICIPANT_ROLE, PARTICIPANT_STATUS } from './participant.constants'
import { Types } from 'mongoose';

const objectIdSchema = z.string().refine(val => Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
});

const createValidationSchema = z.object({
  body: z.object({
    room: objectIdSchema,
    role: z.enum(Object.values(PARTICIPANT_ROLE) as [string, ...string[]], {
      required_error: 'Participant role is required!',
    }).optional(),
  }),
})

const updateStatusValidationSchema = z.object({
  body: z.object({
    status: z.enum(Object.values(PARTICIPANT_STATUS) as [string, ...string[]], {
      required_error: 'Participant status is required!',
    }),
  }),
})

export const ParticipantValidation = {
  createValidationSchema,
  updateStatusValidationSchema
}
