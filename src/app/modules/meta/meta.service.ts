import { USER_ROLE, USER_STATUS } from '../user/user.constant'
import { User } from '../user/user.model'
import { getUserOverview } from './meta.utils'

const fetchDashboardMetaData = async (
  user: any,
  query: Record<string, unknown>,
) => {
  if (user?.role !== USER_ROLE.admin) {
    throw new Error('Invalid user role!')
  }
  return await getAdminMetaData(query)
}

const getAdminMetaData = async (query: Record<string, unknown>) => {
  const { year } = query

  const totalUserCount = await User.countDocuments({
    role: USER_ROLE.user,
    status: USER_STATUS.active,
    isDeleted: false,
  })
  const totalPlanerCount = await User.countDocuments({
    role: USER_ROLE.planer,
    status: USER_STATUS.active,
    isDeleted: false,
  })
  const totalVendorCount = await User.countDocuments({
    role: USER_ROLE.vendor,
    status: USER_STATUS.active,
    isDeleted: false,
  })

  const selectedYear = year
    ? parseInt(year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  // Fetch user registration overview based on the selected year
  const userOverview = await getUserOverview(selectedYear)

  return {
    totalUserCount,
    totalPlanerCount,
    totalVendorCount,
    userOverview
  }
}


export const MetaService = {
  fetchDashboardMetaData,
}
