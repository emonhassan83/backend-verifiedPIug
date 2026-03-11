// src/app/modules/paystackRecipient/paystackRecipient.service.ts

import { PaystackRecipient } from './paystackRecipient.model';
import { User } from '../user/user.model';
import { createPaystackRecipient } from '../../utils/paystack.utils'; // আগের ফাংশন
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { startSession } from 'mongoose';
import { RECIPIENT_STATUS } from './paystackRecipient.constant';
import axios from 'axios';
import config from '../../config';

const connectPaystackRecipient = async (
  userId: string,
  payload: {
    accountNumber: string;
    bankCode: string;
    accountName: string
  }
) => {
  const session = await startSession();
  try {
    await session.startTransaction();

    const user = await User.findById(userId).session(session);
    if (!user || user.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Paystack-এ recipient তৈরি
    const recipientData = await createPaystackRecipient({
      type: 'nuban',
      name: payload.accountName,
      account_number: payload.accountNumber,
      bank_code: payload.bankCode,
      currency: 'NGN',
      metadata: { userId },
    });

    // ডাটাবেসে সেভ করা (প্রোডাকশনে pending রাখা হয়েছে)
    const [newRecipient] = await PaystackRecipient.create(
      [{
        user: userId,
        recipientCode: recipientData.recipient_code,
        accountName: payload.accountName,
        accountNumber: payload.accountNumber,
        bankCode: payload.bankCode,
        bankName: recipientData.bank_name || null, // Paystack থেকে আসা bank name
        currency: 'NGN',
        status: RECIPIENT_STATUS.pending, // ← Live-এ pending রাখুন
        isDefault: true, // প্রথমটাকে ডিফল্ট
        metadata: recipientData.metadata || {},
      }],
      { session }
    );

    // আগের ডিফল্টগুলো রিসেট (অপশনাল — যদি একাধিক account সাপোর্ট করতে চান)
    await PaystackRecipient.updateMany(
      { user: userId, _id: { $ne: newRecipient._id } },
      { isDefault: false },
      { session }
    );

    await session.commitTransaction();

    return {
      success: true,
      recipient: newRecipient,
      message: 'Bank account added successfully. Verification in progress (usually takes a few minutes).'
    };
  } catch (error: any) {
    await session.abortTransaction();
    throw new AppError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || 'Failed to connect Paystack account'
    );
  } finally {
    session.endSession();
  }
};

export const getPaystackBanks = async () => {
  const response = await axios.get(
    'https://api.paystack.co/bank?currency=NGN&perPage=100',
    {
      headers: {
        Authorization: `Bearer ${config.paystack.secret_key}`,
      },
    }
  )
  return response.data.data
}

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
  getPaystackBanks,
  getUserRecipients,
  setDefaultRecipient,
  deleteRecipient,
};