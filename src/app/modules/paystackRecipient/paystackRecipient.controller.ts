import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import httpStatus from 'http-status'
import { PaystackRecipientService } from './paystackRecipient.service';

const connectAccount = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const result = await PaystackRecipientService.connectPaystackRecipient(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Paystack recipient account connected successfully',
    data: result,
  });
});

const getMyRecipients = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const result = await PaystackRecipientService.getUserRecipients(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Your Paystack recipients fetched successfully',
    data: result,
  });
});

const setDefault = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { recipientId } = req.params;

  const result = await PaystackRecipientService.setDefaultRecipient(userId, recipientId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Default recipient updated successfully',
    data: result,
  });
});

const deleteRecipient = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { recipientId } = req.params;

  const result = await PaystackRecipientService.deleteRecipient(userId, recipientId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Recipient deleted successfully',
    data: result,
  });
});

export const PaystackRecipientController = {
  connectAccount,
  getMyRecipients,
  setDefault,
  deleteRecipient,
};