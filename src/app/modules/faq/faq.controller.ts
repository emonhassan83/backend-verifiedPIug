import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { FaqService } from './faq.service'

const createFaq = catchAsync(async (req, res) => {
  const result = await FaqService.createFaqIntoDB(req.body)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Faq create successfully!',
    data: result,
  })
})

const getAllFaqs = catchAsync(async (req, res) => {
  const result = await FaqService.getAllFaqsFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Faqs retrieved successfully!',
    meta: result.meta,
    data: result.result,
  })
})

const getCategoriesFaqs = catchAsync(async (req, res) => {
  req.query['category'] = req.query
  const result = await FaqService.getAllFaqsFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Faqs retrieved successfully!',
    meta: result.meta,
    data: result.result,
  })
})

const getAFaq = catchAsync(async (req, res) => {
  const result = await FaqService.getAFaqFromDB(req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Faq retrieved successfully!',
    data: result,
  })
})

const updateFaq = catchAsync(async (req, res) => {
  const result = await FaqService.updateFaqFromDB(
    req.params.id,
    req.body
  )

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Faq update successfully!',
    data: result,
  })
})

const deleteAFaq = catchAsync(async (req, res) => {
  const result = await FaqService.deleteAFaqFromDB(req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Faq delete successfully!',
    data: result,
  })
})

export const FaqControllers = {
  createFaq,
  getAllFaqs,
  getCategoriesFaqs,
  getAFaq,
  updateFaq,
  deleteAFaq,
}
