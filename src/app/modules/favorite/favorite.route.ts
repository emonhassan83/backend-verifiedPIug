import express from 'express'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { FavoriteControllers } from './favorite.controller'

const router = express.Router()

router.post(
  '/:serviceId',
  auth(USER_ROLE.user),
  FavoriteControllers.insertIntoDB,
)

router.get('/', auth(USER_ROLE.user), FavoriteControllers.getAllIntoDB)
router.get('/:id', auth(USER_ROLE.user), FavoriteControllers.getAIntoDB)
router.delete('/:id', auth(USER_ROLE.user), FavoriteControllers.deleteAIntoDB)

export const FavoriteRoutes = router
