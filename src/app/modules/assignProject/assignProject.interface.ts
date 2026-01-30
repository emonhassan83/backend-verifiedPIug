import { Model, Types } from 'mongoose'
import { TAssignmentPaymentStatus, TVendorAssignmentStatus } from './assignProject.constants'

export interface TAssignProject {
  _id?: string
  project: Types.ObjectId
  vendor: Types.ObjectId
  assignedBy: Types.ObjectId
  vendorOrder: Types.ObjectId
  serviceType: string[]
  serviceDescription: string
  agreedAmount: number
  paidAmount: number
  deadline: string
  startDate: string
  completedDate: string
  notes: string
  paymentStatus: TAssignmentPaymentStatus
  status: TVendorAssignmentStatus
}

export type TAssignProjectModel = Model<TAssignProject, Record<string, unknown>>
