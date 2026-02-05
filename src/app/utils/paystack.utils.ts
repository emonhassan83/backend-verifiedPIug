import axios from "axios";
import AppError from "../errors/AppError";
import httpStatus from 'http-status'
import config from "../config";

export const createPaystackRecipient = async (data: {
  type: 'nuban',
  name: string,
  description?: string,
  account_number: string,
  bank_code: string, // e.g., "044" for Access Bank
  currency: 'NGN',
  metadata?: any,
}) => {
  try {
    const response = await axios.post(
      'https://api.paystack.co/transferrecipient',
      {
        type: data.type,
        name: data.name,
        description: data.description,
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
      }
    );

    if (response.data.status) {
      return {
        recipient_code: response.data.data.recipient_code,
        details: response.data.data.details,
      };
    } else {
      throw new AppError(httpStatus.BAD_REQUEST, response.data.message);
    }
  } catch (error: any) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error?.response?.data?.message || 'Failed to create Paystack recipient'
    );
  }
};