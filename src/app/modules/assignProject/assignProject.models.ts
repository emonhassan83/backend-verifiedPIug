import { Schema, model, Types } from 'mongoose'
import { TAssignProject, TAssignProjectModel } from './assignProject.interface'
import {
  ASSIGNMENT_PAYMENT_STATUS,
  VENDOR_ASSIGNMENT_STATUS,
} from './assignProject.constants'

const assignProjectSchema = new Schema<TAssignProject>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    vendor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    vendorOrder: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    serviceType: {
      type: [String],
      required: true,
    },
    serviceDescription: {
      type: String,
      required: false,
    },
    agreedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    deadline: {
      type: String,
      required: false,
    },
    startDate: {
      type: String,
      required: false,
    },
    completedDate: {
      type: String,
      required: false,
    },
    notes: {
      type: String,
      required: false,
    },
    paymentStatus: {
      type: String,
      enum: Object.keys(ASSIGNMENT_PAYMENT_STATUS),
      default: ASSIGNMENT_PAYMENT_STATUS.pending,
    },
    status: {
      type: String,
      enum: Object.keys(VENDOR_ASSIGNMENT_STATUS),
      default: VENDOR_ASSIGNMENT_STATUS.assigned,
    },
  },
  { timestamps: true },
)

export const AssignProject = model<TAssignProject, TAssignProjectModel>(
  'AssignProject',
  assignProjectSchema,
)
