import { Router } from 'express'
import { ProjectController } from './project.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import zodValidationRequest from '../../middleware/validateRequest'
import { ProjectValidation } from './project.validation'

const router = Router()

router.post(
  '/',
  auth(USER_ROLE.planer),
  zodValidationRequest(ProjectValidation.createValidationSchema),
  ProjectController.insertIntoDB,
)

router.patch(
  '/status/:id',
  auth(USER_ROLE.planer),
  zodValidationRequest(ProjectValidation.changeStatusValidationSchema),
  ProjectController.changeStatus,
)


router.get(
  '/:id',
  auth(USER_ROLE.planer),
  ProjectController.getAIntoDB,
)

export const ProjectRoutes = router
