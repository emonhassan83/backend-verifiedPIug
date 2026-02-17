import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import { USER_ROLE, USER_STATUS } from '../user/user.constant'
import { User } from '../user/user.model'
import { getUserOverview } from './meta.utils'
import { Payment } from '../payment/payment.model'
import { PAYMENT_MODEL_TYPE } from '../payment/payment.interface'
import { Project } from '../project/project.models'
import { PROJECT_STATUS } from '../project/project.constants'
import { Order } from '../order/order.models'
import { ORDER_AUTHORITY, ORDER_STATUS } from '../order/order.constants'
import { Notification } from '../notification/notification.model'

const adminMetaData = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const { year } = query;

  const user = await User.findById(userId);
  if (!user || user?.isDeleted || user.role !== USER_ROLE.admin) {
    throw new AppError(httpStatus.NOT_FOUND, 'Admin not found!');
  }

  const selectedYear = year
    ? parseInt(year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear();

  // 1. user, planer and vendor count
  const totalUserCount = await User.countDocuments({
    role: USER_ROLE.user,
    status: USER_STATUS.active,
    isDeleted: false,
  });

  const totalPlanerCount = await User.countDocuments({
    role: USER_ROLE.planer,
    status: USER_STATUS.active,
    isDeleted: false,
  });

  const totalVendorCount = await User.countDocuments({
    role: USER_ROLE.vendor,
    status: USER_STATUS.active,
    isDeleted: false,
  });

  // 2. total subscriptionEarnings
  const totalSubscriptionEarnings = await Payment.aggregate([
    {
      $match: {
        modelType: PAYMENT_MODEL_TYPE.Subscription,
        status: 'paid',
        isPaid: true,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
      },
    },
  ]).then(result => result[0]?.total || 0);

  // 3. revenueByCategory → order type wise brake down
  const revenueByCategory = await Payment.aggregate([
    {
      $match: {
        modelType: PAYMENT_MODEL_TYPE.Order,
        status: 'paid',
        isPaid: true,
        isDeleted: false,
      },
    },
    {
      $lookup: {
        from: 'orders',
        localField: 'reference',
        foreignField: '_id',
        as: 'order',
      },
    },
    { $unwind: '$order' },
    {
      $group: {
        _id: '$order.type',
        amount: { $sum: '$amount' },
      },
    },
    {
      $project: {
        category: '$_id',
        amount: 1,
        _id: 0,
      },
    },
    { $sort: { amount: -1 } },
  ]);

  // ৪. recentUsers → users
  const recentUsers = await User.find({
    role: { $ne: USER_ROLE.admin },
    isDeleted: false,
  })
    .select('name email photoUrl address role status createdAt')
    .sort({ createdAt: -1 })
    .limit(5);

  // ৫. User register overview
  const userOverview = await getUserOverview(selectedYear);

  return {
    totalUserCount,
    totalPlanerCount,
    totalVendorCount,
    subscriptionEarnings: totalSubscriptionEarnings, 
    revenueByCategory,                              
    recentUsers,                                    
    userOverview,
  };
};

const plannerMetaData = async (
  userId: string
) => {
  const user = await User.findById(userId);
  if (!user || user?.isDeleted || user.role !== USER_ROLE.admin) {
    throw new AppError(httpStatus.NOT_FOUND, 'Planer not found!');
  }

  // 1. active project, planer and vendor count
  const activeProjectCount = await Project.countDocuments({
    status: PROJECT_STATUS.ongoing,
    isDeleted: false,
  });

  const upcomingEventCount = await Order.countDocuments({
    authority: ORDER_AUTHORITY.client,
    status: ORDER_STATUS.running,
    isDeleted: false,
  });

  const newLeadCount = await User.countDocuments({
    role: USER_ROLE.vendor,
    status: USER_STATUS.active,
    isDeleted: false,
  });

  // 2. total subscriptionEarnings
  const totalEarnings = await Payment.aggregate([
    {
      $match: {
        modelType: PAYMENT_MODEL_TYPE.Order,
        status: 'paid',
        isPaid: true,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
      },
    },
  ]).then(result => result[0]?.total || 0);


  // ৪. recentNotify → Client
  const recentNotification = await Notification.find({
    receiver: userId,
    isDeleted: false,
  })
    .select('message description read createdAt')
    .sort({ createdAt: -1 })
    .limit(3);

  return {
    activeProjectCount,
    upcomingEventCount,
    newLeadCount,
    totalEarnings,                          
    recentNotification,                                    
  };
};

export const MetaService = {
  adminMetaData,
  plannerMetaData,

}
