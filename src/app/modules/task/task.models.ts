import { Schema, model } from "mongoose";
import { TTask, TTaskModel } from "./task.interface";

const taskSchema = new Schema<TTask>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    date: {
      type: String,
      required: true,
    },

    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Task = model<TTask, TTaskModel>("Task", taskSchema);
