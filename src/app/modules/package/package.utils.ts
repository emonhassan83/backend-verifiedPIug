import config from '../../config'
import AppError from '../../errors/AppError'
import httpStatus from 'http-status'
import axios from 'axios'

// Create Paystack plan
export const createPaystackPlan = async (payload: {
  name: string
  amount: number
  interval: string
}) => {
  try {
    console.log(`Creating Paystack plan: ${JSON.stringify(payload)}`)
    const response = await axios.post(
      'https://api.paystack.co/plan',
      {
        name: payload.name,
        amount: payload.amount * 100, // Convert to kobo
        interval: payload.interval.toLowerCase(),
      },
      {
        headers: {
          Authorization: `Bearer ${config.paystack.secret_key}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (response.data.status) {
      console.log(
        `Paystack plan created: plan_code = ${response.data.data.plan_code}`,
      )
      return response.data.data.plan_code
    } else {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        response.data.message || 'Failed to create Paystack plan',
      )
    }
  } catch (error: any) {
    console.error(
      `Error creating Paystack plan: ${error?.response?.data?.message || error.message}`,
    )
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error?.response?.data?.message || 'Paystack plan creation failed',
    )
  }
}

// Update Paystack plan
export const updatePaystackPlan = async (
  planCode: string,
  payload: { name: string; amount: number; interval: string },
) => {
  try {
    console.log(
      `Updating Paystack plan: code=${planCode}, payload=${JSON.stringify(payload)}`,
    )
    const response = await axios.put(
      `https://api.paystack.co/plan/${planCode}`,
      {
        name: payload.name,
        amount: payload.amount * 100,
        interval: payload.interval.toLowerCase(),
      },
      {
        headers: {
          Authorization: `Bearer ${config.paystack.secret_key}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (response.data.status) {
      console.log(`Paystack plan updated: code=${planCode}`)
      return response.data.data
    } else {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        response.data.message || 'Failed to update Paystack plan',
      )
    }
  } catch (error: any) {
    console.error(
      `Error updating Paystack plan: ${error?.response?.data?.message || error.message}`,
    )
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error?.response?.data?.message || 'Paystack plan update failed',
    )
  }
}

// Archive Paystack plan (set active to false, since delete is not supported)
export const archivePaystackPlan = async (planCode: string) => {
  try {
    console.log(`Archiving Paystack plan: code=${planCode}`)
    const response = await axios.put(
      `https://api.paystack.co/plan/${planCode}`,
      {
        active: false,
      },
      {
        headers: {
          Authorization: `Bearer ${config.paystack.secret_key}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (response.data.status) {
      console.log(`Paystack plan archived: code=${planCode}`)
      return response.data.data
    } else {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        response.data.message || 'Failed to archive Paystack plan',
      )
    }
  } catch (error: any) {
    console.error(
      `Error archiving Paystack plan: ${error?.response?.data?.message || error.message}`,
    )
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error?.response?.data?.message || 'Paystack plan archive failed',
    )
  }
}
