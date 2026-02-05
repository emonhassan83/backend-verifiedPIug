import { Model, Types } from 'mongoose'
import { TOrderStatus, TOrderAuthority, TPaymentStatus } from './order.constants'

export interface TOrder {
  _id?: string;
  sender: Types.ObjectId;          // who created/sent the order request
  receiver: Types.ObjectId;        // who received the request (client/planner)

  authority: TOrderAuthority;      // who is allowed to create this order type

  title: string;
  type: string;                    // e.g. "event-planning", "vendor-service"
  shortDescription: string;
  description: string;

  duration: number;                // in days/hours
  totalAmount: number;             // renamed from amount (more clear)

  // ── Payment Fields ────────────────────────────────────────
  initialAmount: number;           // amount to be paid to start
  pendingAmount: number;           // remaining after initial payment
  finalAmount: number;             // final amount due on completion (can be same as pending or adjusted)
  refundAmount: number;             // final amount due on completion (can be same as pending or adjusted)

  initialPayment: {
    amountPaid: number;
    paidAt?: Date;
    transactionId?: string;
    status: TPaymentStatus;
  };

  finalPayment: {
    amountPaid: number;
    paidAt?: Date;
    transactionId?: string;
    status: TPaymentStatus;
  };

  // ── Timeline & Status ─────────────────────────────────────
  startDate?: string | Date;
  endDate?: string | Date;
  actualStartDate?: Date;          // when project actually started
  actualEndDate?: Date;            // when project completed

  latitude: number;
  longitude: number;
  address: string;
  locationUrl: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };

  status: TOrderStatus;            // e.g. pending, accepted, in-progress, completed, cancelled

  // Flags for quick checks (very useful for UI & queries)
  initialPayCompleted: boolean;
  finalPayCompleted: boolean;
  isFullyPaid: boolean;            // computed: initial + final paid
  isCompleted: boolean;            // project done + fully paid

  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TOrderModel = Model<TOrder, Record<string, unknown>>
