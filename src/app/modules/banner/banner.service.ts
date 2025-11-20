import httpStatus from 'http-status'
import { TBanner } from './banner.interface'
import QueryBuilder from '../../builder/QueryBuilder'
import { Banner } from './banner.models'
import AppError from '../../errors/AppError'
import { uploadToS3 } from '../../utils/s3'

// Create a new Banner
const insertIntoDB = async (files: any) => {
  const uploadedFiles = files?.files;

  if (!uploadedFiles || uploadedFiles.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "No files uploaded");
  }

  const createdBanners = [];

  for (const file of uploadedFiles) {
    // Upload each file to S3
    const url = (await uploadToS3({
      file,
      fileName: `images/banners/${Date.now()}-${Math.floor(
        100000 + Math.random() * 900000
      )}`,
    })) as string;

    // Create one document per file
    const banner = await Banner.create({ url });

    createdBanners.push(banner);
  }

  return createdBanners;
};

// Get all Banner
const getAllIntoDB = async (query: Record<string, any>) => {
  const BannerModel = new QueryBuilder(Banner.find(), query)
    .search([''])
    .filter()
    .paginate()
    .sort()
    .fields()

  const data = await BannerModel.modelQuery
  const meta = await BannerModel.countTotal()
  return {
    data,
    meta,
  }
}

// Delete Banner
const deleteAIntoDB = async (id: string) => {
  const result = await Banner.findByIdAndDelete(id)
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Banner deletion failed')
  }

  return result
}

export const BannerService = {
  insertIntoDB,
  getAllIntoDB,
  deleteAIntoDB,
}
