// src/app/modules/paystackRecipient/paystackRecipient.service.ts

import { PaystackRecipient } from './paystackRecipient.model';
import { User } from '../user/user.model';
import { createPaystackRecipient } from '../../utils/paystack.utils'; // আগের ফাংশন
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { startSession } from 'mongoose';

const connectPaystackRecipient = async (
  userId: string,
  payload: {
    accountNumber: string;
    bankCode: string;
    accountName: string;
  }
) => {
  const session = await startSession();
  try {
    await session.startTransaction();

    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Paystack-এ recipient তৈরি
    const recipient = await createPaystackRecipient({
      type: 'nuban',
      name: payload.accountName,
      account_number: payload.accountNumber,
      bank_code: payload.bankCode,
      currency: 'NGN',
      metadata: { userId },
    });

    // ডাটাবেসে সেভ করা
    const newRecipient = await PaystackRecipient.create(
      [{
        user: userId,
        recipientCode: recipient.recipient_code,
        accountName: payload.accountName,
        accountNumber: payload.accountNumber,
        bankCode: payload.bankCode,
        status: 'verified', // test-এর জন্য verified রাখলাম, প্রোডাকশনে pending রাখতে পারো
        isDefault: true,    // প্রথমটাকে ডিফল্ট করা যায়
      }],
      { session }
    );

    // যদি ইউজারের আগের ডিফল্ট থাকে তাহলে রিসেট করা যেতে পারে (অপশনাল)
    await PaystackRecipient.updateMany(
      { user: userId, _id: { $ne: newRecipient[0]._id } },
      { isDefault: false },
      { session }
    );

    await session.commitTransaction();

    return newRecipient[0];
  } catch (error: any) {
    await session.abortTransaction();
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, error.message || 'Failed to connect Paystack account');
  } finally {
    session.endSession();
  }
};

const getUserRecipients = async (userId: string) => {
  return await PaystackRecipient.find({
    user: userId,
    isDeleted: false,
  }).sort({ isDefault: -1, createdAt: -1 });
};

const setDefaultRecipient = async (userId: string, recipientId: string) => {
  const recipient = await PaystackRecipient.findOne({
    _id: recipientId,
    user: userId,
    isDeleted: false,
  });

  if (!recipient) {
    throw new AppError(httpStatus.NOT_FOUND, 'Recipient not found');
  }

  await PaystackRecipient.updateMany(
    { user: userId },
    { isDefault: false }
  );

  await PaystackRecipient.findByIdAndUpdate(recipientId, { isDefault: true });

  return recipient;
};

const deleteRecipient = async (userId: string, recipientId: string) => {
  const recipient = await PaystackRecipient.findOneAndUpdate(
    { _id: recipientId, user: userId },
    { isDeleted: true },
    { new: true }
  );

  if (!recipient) {
    throw new AppError(httpStatus.NOT_FOUND, 'Recipient not found');
  }

  // যদি এটা ডিফল্ট ছিল তাহলে অন্য একটা ডিফল্ট করা যেতে পারে
  if (recipient.isDefault) {
    const another = await PaystackRecipient.findOne({ user: userId, isDeleted: false });
    if (another) {
      await PaystackRecipient.findByIdAndUpdate(another._id, { isDefault: true });
    }
  }

  return { success: true, message: 'Recipient deleted successfully' };
};

export const PaystackRecipientService = {
  connectPaystackRecipient,
  getUserRecipients,
  setDefaultRecipient,
  deleteRecipient,
};