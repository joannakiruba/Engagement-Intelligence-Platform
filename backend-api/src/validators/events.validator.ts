import Joi from 'joi';

export const createEventSchema = Joi.object({
  title: Joi.string().min(1).required()
    .messages({ 'string.empty': 'Title is required' }),

  eventType: Joi.string().min(1).required()
    .messages({ 'string.empty': 'eventType is required' }),

  eventDate: Joi.string().isoDate().required()
    .messages({ 'string.isoDate': 'eventDate must be a valid ISO date' }),

  description: Joi.string().allow('', null).optional(),

  registrationDeadline: Joi.string().isoDate().allow(null).optional()
    .messages({ 'string.isoDate': 'registrationDeadline must be a valid ISO date' }),
});

export const updateEventSchema = Joi.object({
  title: Joi.string().min(1).optional(),

  eventType: Joi.string().min(1).optional(),

  eventDate: Joi.string().isoDate().optional()
    .messages({ 'string.isoDate': 'eventDate must be a valid ISO date' }),

  description: Joi.string().allow('', null).optional(),

  registrationDeadline: Joi.string().isoDate().allow(null).optional()
    .messages({ 'string.isoDate': 'registrationDeadline must be a valid ISO date' }),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });
