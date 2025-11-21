import { Router } from 'express'
import { UserRoutes } from '../modules/user/user.route'
import { AuthRoutes } from '../modules/auth/auth.route'
import { otpRoutes } from '../modules/otp/otp.route'
import { contentsRoutes } from '../modules/contents/contents.route'
import { NotificationRoutes } from '../modules/notification/notification.route'
import { CategoryRoutes } from '../modules/categories/categories.route'
import { BannerRoutes } from '../modules/banner/banner.route'
import { FaqRoutes } from '../modules/faq/faq.route'
import { VerificationRoutes } from '../modules/verification/verification.route'
import { PortfolioRoutes } from '../modules/portfolio/portfolio.route'

const router = Router()

const moduleRoutes = [
  {
    path: '/auth',
    route: AuthRoutes,
  },
  {
    path: '/users',
    route: UserRoutes,
  },
  {
    path: '/otp',
    route: otpRoutes,
  },
  {
    path: '/categories',
    route: CategoryRoutes,
  },
  {
    path: '/portfolio',
    route: PortfolioRoutes,
  },
  {
    path: '/verifications',
    route: VerificationRoutes,
  },
  {
    path: '/banners',
    route: BannerRoutes,
  },
  {
    path: '/faq',
    route: FaqRoutes,
  },
  {
    path: '/contents',
    route: contentsRoutes,
  },
  {
    path: '/notifications',
    route: NotificationRoutes,
  },
]

moduleRoutes.forEach((route) => router.use(route.path, route.route))

export default router
