import httpStatus from 'http-status'
import QueryBuilder from '../../builder/QueryBuilder'
import { Portfolio } from './portfolio.models'
import AppError from '../../errors/AppError'
import { uploadToS3 } from '../../utils/s3'
import { User } from '../user/user.model'
import { checkSubscriptionPermission } from '../../utils/subscription.utils'

// Create a new Portfolio
const insertIntoDB = async (userId: string, files: any) => {
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found')
  }

  // Check subscription permission for portfolio upload
  await checkSubscriptionPermission(userId, 'canUploadPortfolio')

  const uploadedFiles = files?.files

  if (!uploadedFiles || uploadedFiles.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'No files uploaded')
  }

  const createdPortfolios = []

  for (const file of uploadedFiles) {
    // Upload each file to S3
    const url = (await uploadToS3({
      file,
      fileName: `images/Portfolios/${Date.now()}-${Math.floor(
        100000 + Math.random() * 900000,
      )}`,
    })) as string

    // Create one document per file WITH author field
    const portfolio = await Portfolio.create({
      author: userId,
      url,
    })

    createdPortfolios.push(portfolio)
  }

  return createdPortfolios
}

// Get all Portfolio
const getAllIntoDB = async (query: Record<string, any>) => {
  const PortfolioModel = new QueryBuilder(Portfolio.find(), query)
    .search([''])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await PortfolioModel.modelQuery
  const meta = await PortfolioModel.countTotal()
  return {
    data,
    meta,
  }
}

// Delete Portfolio
const deleteAIntoDB = async (id: string) => {
  const result = await Portfolio.findByIdAndDelete(id)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Portfolio deletion failed')
  }

  return result
}

export const PortfolioService = {
  insertIntoDB,
  getAllIntoDB,
  deleteAIntoDB,
}
