import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import { USER_ROLE, USER_STATUS } from '../user/user.constant'
import { User } from '../user/user.model'
import { getUserOverview } from './meta.utils'
import { Payment } from '../payment/payment.model'
import { PAYMENT_MODEL_TYPE } from '../payment/payment.interface'
import { PAYMENT_STATUS } from '../order/order.constants'

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

  // ১. মোট ইউজার, প্ল্যানার, ভেন্ডর কাউন্ট
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

  // ২. মোট subscriptionEarnings (সমস্ত ভেন্ডরের subscription থেকে আয়)
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

  // ৩. revenueByCategory → অর্ডারের type অনুযায়ী আয়ের ব্রেকডাউন
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
        _id: '$order.type', // order এর type ফিল্ড
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

  // ৪. recentUsers → শেষ ৫ জন নতুন ইউজার (admin ছাড়া)
  const recentUsers = await User.find({
    role: { $ne: USER_ROLE.admin },
    isDeleted: false,
  })
    .select('id name email photoUrl role createdAt')
    .sort({ createdAt: -1 })
    .limit(5);

  // ৫. ইউজার রেজিস্ট্রেশন ওভারভিউ (আগের কোড অক্ষুণ্ণ)
  const userOverview = await getUserOverview(selectedYear);

  return {
    totalUserCount,
    totalPlanerCount,
    totalVendorCount,
    subscriptionEarnings: totalSubscriptionEarnings, // নতুন ফিল্ড
    revenueByCategory,                              // নতুন ফিল্ড
    recentUsers,                                    // নতুন ফিল্ড
    userOverview,
  };
};

export const MetaService = {
  adminMetaData,
}
