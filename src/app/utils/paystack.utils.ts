import axios from 'axios'
import AppError from '../errors/AppError'
import httpStatus from 'http-status'
import config from '../config'

export const createPaystackRecipient = async (data: {
  type: 'nuban'
  name: string
  account_number: string
  bank_code: string
  currency: 'NGN'
  metadata?: any
}) => {
  try {
    console.log(
      `Creating Paystack recipient for: ${data.name} | ${data.account_number}`,
    )

    const response = await axios.post(
      'https://api.paystack.co/transferrecipient',
      {
        type: data.type,
        name: data.name,
        account_number: data.account_number,
        bank_code: data.bank_code,
        currency: data.currency,
        metadata: data.metadata,
      },
      {
        headers: {
          Authorization: `Bearer ${config.paystack.secret_key}`,
          'Content-Type': 'application/json',
        },
      },
    )

    const result = response.data

    if (!result.status) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        result.message || 'Failed to create Paystack recipient',
      )
    }

    const recipient = result.data

    // Paystack-এর verification status চেক
    if (recipient.active === false) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        recipient.details?.error ||
          'Account verification failed - invalid details',
      )
    }

    // সফল হলে recipient_code রিটার্ন
    return {
      recipient_code: recipient.recipient_code,
      details: recipient.details,
      active: recipient.active,
      bank_name: recipient.bank_name || recipient.details?.bank_name,
    }
  } catch (error: any) {
    const message = error?.response?.data?.message || error.message

    // সাধারণ এরর মেসেজগুলো আরও ইউজার-ফ্রেন্ডলি করে দেওয়া
    if (message.includes('Invalid bank code')) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid bank code provided')
    }
    if (message.includes('Account number is invalid')) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid account number')
    }
    if (message.includes('Account name does not match')) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Account name does not match the registered name',
      )
    }

    console.error('Paystack recipient creation error:', message)
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      message || 'Failed to create recipient',
    )
  }
}
