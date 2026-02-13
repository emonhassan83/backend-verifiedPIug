import { USER_ROLE, USER_STATUS } from '../user/user.constant'
import { User } from '../user/user.model'
import { startOfYear, endOfYear } from 'date-fns'

export const getUserOverview = async (year: number) => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const isCurrentYear = year === currentYear

  const yearStart = startOfYear(new Date(year, 0, 1))
  const yearEnd = endOfYear(new Date(year, 11, 31))

  // Aggregate Monthly User Registrations
  const monthlyUsers = await User.aggregate([
    {
      $match: {
        role: USER_ROLE.user,
        createdAt: { $gte: yearStart, $lte: yearEnd },
        status: USER_STATUS.active,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const filteredMonths = isCurrentYear
    ? months.slice(0, now.getMonth() + 1)
    : months

  const userOverview = filteredMonths.map((month, index) => {
    const data = monthlyUsers.find((m: any) => m._id === index + 1)
    return { month, count: data ? data.count : 0 }
  })

  return userOverview
}