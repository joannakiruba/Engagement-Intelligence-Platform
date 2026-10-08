import Joi from 'joi';

export const getTrainingHistorySchema = Joi.object({
  page: Joi.number().integer().min(1).optional()
    .messages({ 'number.min': 'page must be at least 1' }),
  limit: Joi.number().integer().min(1).max(100).optional()
    .messages({
      'number.min': 'limit must be at least 1',
      'number.max': 'limit must be at most 100',
    }),
  from: Joi.date().iso().optional()
    .messages({ 'date.format': 'from must be a valid ISO 8601 date' }),
  to: Joi.date().iso().optional()
    .when('from', {
      is: Joi.exist(),
      then: Joi.date().iso().min(Joi.ref('from')).messages({
        'date.min': 'to date must be after or equal to from date',
      }),
    }),
});
