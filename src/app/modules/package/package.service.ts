import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { TPackage } from './package.interface'
import { Package } from './package.model'
import { PackageSearchableFields } from './package.constant'
import {
  archivePaystackPlan,
  createPaystackPlan,
  updatePaystackPlan,
} from './package.utils'
import { startSession } from 'mongoose'

const createPackageIntoDB = async (payload: TPackage) => {
  const session = await startSession();
  try {
    await session.startTransaction();

    const { type, billingCycle, title, price } = payload;

    // ১. একই ধরনের প্যাকেজ আছে কিনা চেক
    const existing = await Package.findOne({
      type,
      billingCycle,
      isDeleted: false,
    }).session(session);

    if (existing) {
      throw new AppError(
        httpStatus.CONFLICT,
        `A package with type "${type}" and billing cycle "${billingCycle}" already exists!`
      );
    }

    // ২. Paystack-এ প্ল্যান তৈরি করা (শুধু এখানেই)
    const planCode = await createPaystackPlan({
      name: title,
      amount: price,
      interval: billingCycle,
    });

    // ৩. planCode যোগ করা
    payload.planCode = planCode;

    // ৪. ডাটাবেসে প্যাকেজ সেভ
    const newPackage = await Package.create([payload], { session });
    if (!newPackage[0]) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Package creation failed!');
    }

    await session.commitTransaction();
    return newPackage[0];
  } catch (error: any) {
    await session.abortTransaction();
    console.error('Package creation failed:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error.message || 'Package creation failed'
    );
  } finally {
    session.endSession();
  }
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

const updatePackageFromDB = async (id: string, payload: Partial<TPackage>) => {
  const session = await startSession()
  try {
    await session.startTransaction()

    const packageData = await Package.findById(id).session(session)
    if (!packageData || packageData?.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'Package not found')
    }

    // Update plan in Paystack if name, price, or interval changes
    if (payload.title || payload.price || payload.billingCycle) {
      await updatePaystackPlan(packageData.planCode, {
        name: payload.title || packageData.title,
        amount: payload.price || packageData.price,
        interval: payload.billingCycle || packageData.billingCycle,
      })
    }

    // Update package in database
    const updatedPackage = await Package.findByIdAndUpdate(id, payload, {
      session,
      new: true,
    })

    if (!updatedPackage) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Package update failed')
    }

    await session.commitTransaction()
    return updatedPackage
  } catch (error: any) {
    await session.abortTransaction()
    console.error('Package update error:', error.message)
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error.message || 'Package update failed',
    )
  } finally {
    session.endSession()
  }
}

const deleteAPackageFromDB = async (id: string) => {
  const session = await startSession()
  try {
    await session.startTransaction()

    const packageData = await Package.findById(id).session(session)
    if (!packageData || packageData?.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'Package not found')
    }

    // Archive plan in Paystack
    await archivePaystackPlan(packageData.planCode)

    // Delete package in database (soft delete)
    const result = await Package.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { session, new: true },
    )

    if (!result) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Package delete failed')
    }

    await session.commitTransaction()
    return result
  } catch (error: any) {
    await session.abortTransaction()
    console.error('Package delete error:', error.message)
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error.message || 'Package delete failed',
    )
  } finally {
    session.endSession()
  }
}

export const PackageService = {
  createPackageIntoDB,
  getAllPackagesFromDB,
  getAPackageFromDB,
  updatePackageFromDB,
  deleteAPackageFromDB,
}
