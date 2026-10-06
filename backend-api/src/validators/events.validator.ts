import Joi from 'joi';

export const createEventSchema = Joi.object({
  title: Joi.string().min(1).required()
    .messages({ 'string.min': 'Title must not be empty', 'any.required': 'Title is required' }),
  description: Joi.string().allow('', null).optional(),
  category: Joi.string().valid('CODING', 'HACKATHON', 'OTHER').default('OTHER'),
  isMandatory: Joi.boolean().default(false),
  batchIds: Joi.array().items(Joi.string().uuid()).unique().default([])
    .messages({ 'array.unique': 'batchIds must not contain duplicates', 'string.guid': 'Each batchId must be a valid UUID' }),
  mode: Joi.string().valid('ONLINE', 'OFFLINE').optional(),
  officialLink: Joi.string().uri().allow('', null).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  venue: Joi.string().allow('', null).optional(),
  fee: Joi.number().min(0).optional(),
});

export const updateEventSchema = Joi.object({
  title: Joi.string().min(1).optional(),
  description: Joi.string().allow('', null).optional(),
  category: Joi.string().valid('CODING', 'HACKATHON', 'OTHER').optional(),
  isMandatory: Joi.boolean().optional(),
  addBatchIds: Joi.array().items(Joi.string().uuid()).unique().optional()
    .messages({ 'array.unique': 'addBatchIds must not contain duplicates', 'string.guid': 'Each batchId must be a valid UUID' }),
  mode: Joi.string().valid('ONLINE', 'OFFLINE').allow(null).optional(),
  officialLink: Joi.string().uri().allow('', null).optional(),
  startDate: Joi.date().iso().allow(null).optional(),
  endDate: Joi.date().iso().allow(null).optional(),
  venue: Joi.string().allow('', null).optional(),
  fee: Joi.number().min(0).allow(null).optional(),
}).min(1).messages({
  'object.min': 'At least one field is required to update',
});

export const createRoundSchema = Joi.object({
  name: Joi.string().min(1).required()
    .messages({ 'string.min': 'Round name must not be empty', 'any.required': 'Round name is required' }),
  roundDate: Joi.date().iso().allow(null).optional(),
  deadline: Joi.date().iso().allow(null).optional(),
  status: Joi.string().valid('UPCOMING', 'ONGOING', 'DONE').default('UPCOMING'),
});

export const updateRoundSchema = Joi.object({
  name: Joi.string().min(1).optional(),
  roundDate: Joi.date().iso().allow(null).optional(),
  deadline: Joi.date().iso().allow(null).optional(),
  status: Joi.string().valid('UPCOMING', 'ONGOING', 'DONE').optional(),
}).min(1).messages({
  'object.min': 'At least one field is required to update',
});

export const setRegistrationStatusSchema = Joi.object({
  status: Joi.string().valid('INTERESTED', 'REGISTERED', 'WITHDRAWN').required()
    .messages({ 'any.only': 'Status must be INTERESTED, REGISTERED, or WITHDRAWN' }),
});
