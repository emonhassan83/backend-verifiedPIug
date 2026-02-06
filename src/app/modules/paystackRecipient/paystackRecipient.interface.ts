import { Model, Types } from "mongoose";
import { TRecipientStatus } from "./paystackRecipient.constant";

export interface TPaystackRecipient {
  user: Types.ObjectId;
  recipientCode: string;           // Paystack থেকে আসা recipient_code
  accountName: string;
  accountNumber: string;
  bankCode: string;                // e.g. 044
  bankName?: string;               // optional
  currency: string;                // NGN
  status: TRecipientStatus;
  isDefault: boolean;              // ইউজারের ডিফল্ট উইথড্র অ্যাকাউন্ট কিনা
  verifiedAt?: Date;
  rejectedReason?: string;
  metadata?: Record<string, any>;
  isDeleted: boolean;
}

export type TPaystackRecipientModel = Model<TPaystackRecipient, Record<string, unknown>>
