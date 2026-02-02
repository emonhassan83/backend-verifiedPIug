import { Request, Response } from 'express'
import catchAsync from '../../utils/catchAsync'
import { ParticipantsService } from './participant.service'
import sendResponse from '../../utils/sendResponse'

const addAParticipant = catchAsync(async (req: Request, res: Response) => {
  const result = await ParticipantsService.addParticipant(req.body, req.user._id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Participant added successfully',
    data: result,
  })
})

// Get all Participants
const getRoomParticipants = catchAsync(async (req: Request, res: Response) => {
  const result = await ParticipantsService.getRoomParticipants(req.query, req.params.roomId)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Participants retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

// Update Participant
const changeParticipantStatus = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ParticipantsService.updateParticipant(
      req.params.id,
      req.body,
      req.user._id
    )
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Participant status updated successfully',
      data: result,
    })
  },
)

// Remove Participant
const removeParticipant = catchAsync(async (req: Request, res: Response) => {
  const result = await ParticipantsService.removeParticipant(req.params.id, req.user._id)
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Participant removed successfully',
    data: result,
  })
})

export const ParticipantController = {
  addAParticipant,
  getRoomParticipants,
  changeParticipantStatus,
  removeParticipant,
}
