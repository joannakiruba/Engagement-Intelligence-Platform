import Joi from 'joi';

export const registerForEventSchema = Joi.object({
  eventId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'eventId must be a valid UUID',
      'any.required': 'eventId is required',
    }),
});
