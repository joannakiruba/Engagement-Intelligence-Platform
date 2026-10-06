import Joi from 'joi';

export const leaderboardBatchParamsSchema = Joi.object({
  batchId: Joi.string().uuid().required()
    .messages({ 'string.guid': 'batchId must be a valid UUID' }),
});

export const leaderboardQuerySchema = Joi.object({
  week: Joi.string().isoDate().optional()
    .custom((value, helpers) => {
      const date = new Date(value);
      if (date.getUTCDay() !== 1) {
        return helpers.error('any.custom', { message: 'week must be a Monday (start of ISO week)' });
      }
      return value;
    })
    .messages({
      'string.isoDate': 'week must be a valid ISO date (YYYY-MM-DD)',
      'any.custom': '{{#message}}',
    }),
});
