import express from 'express'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { MetaController } from './meta.controller'

const router = express.Router()

router.get('/admin', auth(USER_ROLE.admin), MetaController.adminMetaData)
router.get('/planer', auth(USER_ROLE.planer), MetaController.planerMetaData)
router.get('/vendor', auth(USER_ROLE.vendor), MetaController.vendorMetaData)
router.get('/user', auth(USER_ROLE.user), MetaController.userMetaData)

export const MetaRoutes = router
