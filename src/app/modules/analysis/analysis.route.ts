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
  '/planer-revenue',
  auth(USER_ROLE.planer),
  AnalysisController.planerRevenueAnalysis,
)
router.get(
  '/planer-event',
  auth(USER_ROLE.planer),
  AnalysisController.planerEventAnalysis,
)
router.get(
  '/planer-vendor',
  auth(USER_ROLE.planer),
  AnalysisController.planerVendorAnalysis,
)

router.get(
  '/vendor',
  auth(USER_ROLE.vendor),
  AnalysisController.vendorAnalysisData,
)

router.get(
  '/planer-leads',
  auth(USER_ROLE.planer),
  AnalysisController.planerLeadsData,
)

router.get(
  '/vendor-leads',
  auth(USER_ROLE.vendor),
  AnalysisController.vendorLeadsData,
)

export const AnalysisRoutes = router
