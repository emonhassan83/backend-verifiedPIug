import { Schema, model, Types } from "mongoose";
import { TAssignProject, TAssignProjectModel } from "./assignProject.interface";

const assignProjectSchema = new Schema<TAssignProject>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    vendor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vendorName: {
      type: String,
      required: true,
    },
    vendorCategory: {
      type: String,
      required: true,
    },
    vendorEmail: {
      type: String,
      required: true
    },
    vendorPhone: {
      type: String,
      required: true
    },
    quote: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

export const AssignProject = model<TAssignProject, TAssignProjectModel>(
  "AssignProject",
  assignProjectSchema
);
