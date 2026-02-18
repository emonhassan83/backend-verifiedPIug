import express from 'express'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { AnalysisController } from './analysis.controller'

const router = express.Router()

router.get(
  '/admin',
  auth(USER_ROLE.admin),
  AnalysisController.adminAnalysisData,
)
router.get(
  '/planer',
  auth(USER_ROLE.planer),
  AnalysisController.planerAnalysisData,
)
router.get(
  '/vendor',
  auth(USER_ROLE.vendor),
  AnalysisController.vendorAnalysisData,
)

export const AnalysisRoutes = router
