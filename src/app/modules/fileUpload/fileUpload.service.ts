import httpStatus from 'http-status'
import QueryBuilder from '../../builder/QueryBuilder'
import { File } from './fileUpload.models'
import AppError from '../../errors/AppError'
import { uploadToS3 } from '../../utils/s3'
import { User } from '../user/user.model'
import { TFile } from './fileUpload.interface'
import { Project } from '../project/project.models'
import { bytesToMB } from '../../utils/fileUtils'

// Create a new File
const insertIntoDB = async (userId: string, payload: TFile, files: any) => {
  const { project: projectId } = payload

  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found')
  }

  const project = await Project.findById(projectId)
  if (!project || project?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Project not found')
  }

  const uploadedFiles = files?.files

  if (!uploadedFiles || uploadedFiles.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'No files uploaded')
  }

  const createdFiles = []

  for (const file of uploadedFiles) {
    // Upload each file to S3
    const url = (await uploadToS3({
      file,
      fileName: `images/Files/${Date.now()}-${Math.floor(
        100000 + Math.random() * 900000,
      )}`,
    })) as string

    const fileSizeInMB = bytesToMB(file.size)

    // Create one document per file WITH author field
    const created = await File.create({
      project: project._id,
      url,
      fileSize: fileSizeInMB,
    })

    createdFiles.push(created)
  }

  return createdFiles
}

// Get all File
const getAllIntoDB = async (query: Record<string, any>) => {
  const FileModel = new QueryBuilder(File.find(), query)
    .search([''])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await FileModel.modelQuery
  const meta = await FileModel.countTotal()
  return {
    data,
    meta,
  }
}

// Delete File
const deleteAIntoDB = async (id: string) => {
  const result = await File.findByIdAndDelete(id)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'File deletion failed')
  }

  return result
}

export const FileService = {
  insertIntoDB,
  getAllIntoDB,
  deleteAIntoDB,
}
