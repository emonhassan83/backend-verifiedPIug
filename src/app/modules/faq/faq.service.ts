import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { TFaq } from './faq.interface'
import { Faq } from './faq.model'

const createFaqIntoDB = async (payload: TFaq) => {
  const faq = await Faq.create(payload)
  if (!faq) {
    throw new AppError(httpStatus.CONFLICT, 'Faq not created!')
  }

  return faq
}

const getAllFaqsFromDB = async (query: Record<string, unknown>) => {
  const faqQuery = new QueryBuilder(Faq.find(), query)
    .search(['title'])
    .filter()
    .sort()
    .paginate()
    .fields()

  const result = await faqQuery.modelQuery
  const meta = await faqQuery.countTotal()
  if (!faqQuery) {
    throw new AppError(httpStatus.NOT_FOUND, 'Faq not found!')
  }

  return {
    meta,
    result,
  }
}

const getAFaqFromDB = async (id: string) => {
  const result = await Faq.findById(id)
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Faqs not found')
  }

  return result
}

const updateFaqFromDB = async (id: string, payload: Partial<TFaq>) => {
  const faq = await Faq.findById(id)
  if (!faq) {
    throw new AppError(httpStatus.NOT_FOUND, 'Faqs not found')
  }

  const updateFaq = await Faq.findByIdAndUpdate(id, payload, {
    new: true,
  })
  if (!updateFaq) {
    throw new AppError(httpStatus.NOT_FOUND, 'Faqs not updated')
  }

  return updateFaq
}

const deleteAFaqFromDB = async (id: string) => {
  const faq = await Faq.findById(id)
  if (!faq) {
    throw new AppError(httpStatus.NOT_FOUND, 'Faqs not found')
  }

  const result = await Faq.findByIdAndDelete(id)
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Faq Delete failed')
  }

  return result
}

export const FaqService = {
  createFaqIntoDB,
  getAllFaqsFromDB,
  getAFaqFromDB,
  updateFaqFromDB,
  deleteAFaqFromDB,
}
