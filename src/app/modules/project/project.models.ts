import { Schema, model, Types } from "mongoose";
import { TProject, TProjectModel } from "./project.interface";
import { PROJECT_STATUS } from "./project.constants";

const projectSchema = new Schema<TProject>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    budget: {
      type: Number,
      required: true,
      default: 0,
    },
    expense: {
      type: Number,
      required: true,
      default: 0,
    },
    received: {
      type: Number,
      required: true,
      default: 0,
    },
    vendorCount: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.keys(PROJECT_STATUS),
      default: PROJECT_STATUS.pending,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Project = model<TProject, TProjectModel>(
  "Project",
  projectSchema
);
