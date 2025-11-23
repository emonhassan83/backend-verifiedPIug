import { Schema, model } from 'mongoose'
import { TFile, TFileModel } from './fileUpload.interface'

const fileSchema = new Schema<TFile>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    url: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

export const File = model<TFile, TFileModel>('File', fileSchema)
