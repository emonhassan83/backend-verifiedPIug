import { Router } from 'express'
import { ParticipantController } from './participant.controller'
import validateRequest from '../../middleware/validateRequest'
import { ParticipantValidation } from './participant.validation'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'

const router = Router()

router.post(
  '/',
  auth(USER_ROLE.user, USER_ROLE.vendor, USER_ROLE.planer),
  validateRequest(ParticipantValidation.createValidationSchema),
  ParticipantController.addAParticipant,
)

router.patch(
  '/status/:id',
  auth(USER_ROLE.user, USER_ROLE.vendor, USER_ROLE.planer),
  validateRequest(ParticipantValidation.updateStatusValidationSchema),
  ParticipantController.changeParticipantStatus,
)

router.delete(
  '/:id',
  auth(USER_ROLE.user, USER_ROLE.vendor, USER_ROLE.planer),
  ParticipantController.removeParticipant,
)

router.get(
  '/:roomId',
  auth(USER_ROLE.user, USER_ROLE.vendor, USER_ROLE.planer),
  ParticipantController.getRoomParticipants,
)

export const ParticipantRoutes = router
