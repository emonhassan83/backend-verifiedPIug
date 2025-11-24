import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { TPackage } from './package.interface'
import { Package } from './package.model'
import { PackageSearchableFields } from './package.constant'

const createPackageIntoDB = async (payload: TPackage) => {
  const { type, billingCycle } = payload;

  // 1. Check if same combination already exists
  const existing = await Package.findOne({
    type,
    billingCycle,
    isDeleted: false,
  });

  if (existing) {
    throw new AppError(
      httpStatus.CONFLICT,
      `A package with type "${type}" and billing cycle "${billingCycle}" already exists!`
    );
  }

  // 2. Create new package
  const newPackage = await Package.create(payload);

  if (!newPackage) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Package creation failed!');
  }

  return newPackage;
};

const getAllPackagesFromDB = async (query: Record<string, unknown>) => {
  const packageQuery = new QueryBuilder(
    Package.find({ isDeleted: false }),
    query,
  )
    .search(PackageSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields()

  const result = await packageQuery.modelQuery
  const meta = await packageQuery.countTotal()

  return {
    meta,
    result,
  }
}

const getAPackageFromDB = async (id: string) => {
  const result = await Package.findById(id)
  if (!result || result?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Packages not found')
  }

  return result
}

const updatePackageFromDB = async (id: string, payload: any) => {
  const packages = await Package.findById(id)
  if (!packages || packages?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Packages not found')
  }

  const updatePackage = await Package.findByIdAndUpdate(id, payload, {
    new: true,
  })
  if (!updatePackage) {
    throw new AppError(httpStatus.NOT_FOUND, 'Packages not updated')
  }

  return updatePackage
}

const deleteAPackageFromDB = async (id: string) => {
  const packages = await Package.findById(id)
  if (!packages || packages?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Packages not found')
  }

  const result = await Package.findByIdAndUpdate(
    id,
    {
      isDeleted: true,
    },
    { new: true },
  )

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Packages Delete failed!')
  }

  return result
}

export const PackageService = {
  createPackageIntoDB,
  getAllPackagesFromDB,
  getAPackageFromDB,
  updatePackageFromDB,
  deleteAPackageFromDB,
}
