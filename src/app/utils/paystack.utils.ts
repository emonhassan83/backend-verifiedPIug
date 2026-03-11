import axios from 'axios'
import AppError from '../errors/AppError'
import httpStatus from 'http-status'
import config from '../config'

export const createPaystackRecipient = async (data: {
  type: 'nuban';
  name: string;
  account_number: string;
  bank_code: string;
  currency: 'NGN';
  metadata?: any;
}) => {
  try {
    // Test mode এ mock response return করো
    if (config.paystack.secret_key?.startsWith('sk_test_')) {
      console.log('Test mode: Skipping Paystack account validation');
      return {
        recipient_code: `RCP_test_${Date.now()}`,
        bank_name: 'Test Bank',
        active: true,
        details: {
          bank_name: 'Test Bank',
          bank_code: data.bank_code,
          account_number: data.account_number,
          account_name: data.name,
        },
        metadata: data.metadata,
      };
    }

    // Live mode এ real API call
    console.log(`Creating Paystack recipient for: ${data.name} | ${data.account_number}`);

    const response = await axios.post(
      'https://api.paystack.co/transferrecipient',
      data,
      {
        headers: {
          Authorization: `Bearer ${config.paystack.secret_key}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const result = response.data;

    if (!result.status) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        result.message || 'Failed to create Paystack recipient'
      );
    }

    const recipient = result.data;

    return {
      recipient_code: recipient.recipient_code,
      bank_name: recipient.details?.bank_name || recipient.bank_name,
      active: recipient.active,
      details: recipient.details,
      metadata: recipient.metadata || data.metadata,
    };

  } catch (error: any) {
    console.error('Full Paystack error:', JSON.stringify(error.response?.data, null, 2));

    const message = error.response?.data?.message || error.message;

    if (message?.includes('Invalid bank code')) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid bank code provided');
    }
    if (message?.includes('Account number is invalid')) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid account number');
    }
    if (message?.includes('Account name does not match')) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Account name does not match the registered name'
      );
    }

    console.error('Paystack recipient creation error:', message);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      message || 'Failed to create recipient'
    );
  }
};
