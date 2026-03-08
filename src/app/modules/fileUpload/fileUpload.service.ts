import httpStatus from 'http-status'
import QueryBuilder from '../../builder/QueryBuilder'
import { File } from './fileUpload.models'
import AppError from '../../errors/AppError'
import { uploadToS3 } from '../../utils/s3'
import { User } from '../user/user.model'
import { TFile } from './fileUpload.interface'
import { Project } from '../project/project.models'
import { bytesToMB } from '../../utils/fileUtils'
import { USER_ROLE, USER_STATUS } from '../user/user.constant'
import { checkSubscriptionPermission } from '../../utils/subscription.utils'

// Create a new File
const insertIntoDB = async (userId: string, payload: TFile, files: any) => {
  const { project: projectId } = payload

  // Validate planner
  const user = await User.findOne({
    _id: userId,
    role: USER_ROLE.planer,
    status: USER_STATUS.active,
    isDeleted: false,
  })
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your profile not found')
  }

  // 2. Subscription check: Only Elite can create tasks
  const { level } = await checkSubscriptionPermission(userId, 'teamAccess')
  if (level !== 'elite') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'File upload is only available in the Elite (Planner Pro / Agency) plan. ' +
        'Please upgrade your subscription',
    )
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
const getAllIntoDB = async (query: Record<string, any>, userId: string) => {
    // 1. Validate planner
  const user = await User.findOne({
    _id: userId,
    role: USER_ROLE.planer,
    status: USER_STATUS.active,
    isDeleted: false,
  })
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your profile not found')
  }

  // 2. Subscription check: Only Elite can create tasks
  const { level } = await checkSubscriptionPermission(userId, 'teamAccess')
  if (level !== 'elite') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Task creation is only available in the Elite (Planner Pro / Agency) plan. ' +
        'Please upgrade your subscription',
    )
  }

  const fileModel = new QueryBuilder(File.find(), query)
    .search([''])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await fileModel.modelQuery
  const meta = await fileModel.countTotal()
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
