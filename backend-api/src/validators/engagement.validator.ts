import Joi from 'joi';

export const dateRangeQuerySchema = Joi.object({
  from: Joi.string().isoDate().optional()
    .messages({ 'string.isoDate': 'from must be a valid ISO date' }),
  to: Joi.string().isoDate().optional()
    .messages({ 'string.isoDate': 'to must be a valid ISO date' }),
});

export const batchParamsSchema = Joi.object({
  batchId: Joi.string().uuid().required()
    .messages({ 'string.guid': 'batchId must be a valid UUID' }),
});

export const studentParamsSchema = Joi.object({
  studentId: Joi.string().uuid().required()
    .messages({ 'string.guid': 'studentId must be a valid UUID' }),
});

export const studentQuerySchema = Joi.object({
  batchId: Joi.string().uuid().optional()
    .messages({ 'string.guid': 'batchId must be a valid UUID' }),
  from: Joi.string().isoDate().optional()
    .messages({ 'string.isoDate': 'from must be a valid ISO date' }),
  to: Joi.string().isoDate().optional()
    .messages({ 'string.isoDate': 'to must be a valid ISO date' }),
});
