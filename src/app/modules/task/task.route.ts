import { Router } from 'express'
import { TaskController } from './task.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import zodValidationRequest from '../../middleware/validateRequest'
import { TaskValidation } from './task.validation'

const router = Router()

router.post(
  '/',
  auth(USER_ROLE.planer),
  zodValidationRequest(TaskValidation.createValidationSchema),
  TaskController.insertIntoDB,
)

router.patch(
  '/status/:id',
  auth(USER_ROLE.planer),
  TaskController.changedStatus,
)

router.put(
  '/:id',
  auth(USER_ROLE.planer),
  zodValidationRequest(TaskValidation.updateValidationSchema),
  TaskController.updateIntoDB,
)

router.get(
  '/project/:projectId',
  auth(USER_ROLE.planer),
  TaskController.getAllIntoDB,
)

router.get(
  '/:id',
  auth(USER_ROLE.planer),
  TaskController.getAIntoDB,
)

router.delete(
  '/:id',
  auth(USER_ROLE.planer),
  TaskController.deleteAIntoDB,
)

export const TaskRoutes = router
