import Joi from 'joi';

export const submitProofSchema = Joi.object({
  eventId: Joi.string().uuid().required().messages({
    'string.guid': 'eventId must be a valid UUID',
    'any.required': 'eventId is required',
  }),
});

export const reviewProofSchema = Joi.object({
  status: Joi.string().valid('APPROVED', 'REJECTED').required().messages({
    'any.only': 'status must be APPROVED or REJECTED',
  }),
  remarks: Joi.string().max(2000).allow('', null).optional(),
});
