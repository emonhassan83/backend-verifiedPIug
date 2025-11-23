import { Router } from 'express'
import { AssignProjectController } from './assignProject.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import zodValidationRequest from '../../middleware/validateRequest'
import { AssignProjectValidation } from './assignProject.validation'

const router = Router()

router.post(
  '/',
  auth(USER_ROLE.planer),
  zodValidationRequest(AssignProjectValidation.createValidationSchema),
  AssignProjectController.insertIntoDB,
)

router.put(
  ':id',
  auth(USER_ROLE.planer),
  zodValidationRequest(AssignProjectValidation.updateValidationSchema),
  AssignProjectController.updateIntoDB,
)

router.get(
  '/project/:projectId',
  auth(USER_ROLE.planer),
  AssignProjectController.getAllIntoDB,
)

router.get(
  '/:id',
  auth(USER_ROLE.planer),
  AssignProjectController.getAIntoDB,
)

router.delete(
  '/:id',
  auth(USER_ROLE.planer),
  AssignProjectController.deleteAIntoDB,
)

export const AssignProjectRoutes = router
