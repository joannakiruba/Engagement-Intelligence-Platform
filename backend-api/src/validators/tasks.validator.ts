import Joi from 'joi';

export const createTaskSchema = Joi.object({
  title: Joi.string().min(1).required()
    .messages({ 'string.empty': 'Title is required' }),

  description: Joi.string().allow('').optional(),

  batchIds: Joi.array().items(
    Joi.string().uuid().messages({ 'string.guid': 'Each batchId must be a valid UUID' })
  ).min(1).unique().required()
    .messages({
      'array.min': 'At least one batchId is required',
      'array.unique': 'batchIds must not contain duplicates',
    }),

  isMandatory: Joi.boolean().optional().default(true),

  isInternal: Joi.boolean().optional().default(false),

  maxMarks: Joi.number().positive().optional()
    .messages({ 'number.positive': 'maxMarks must be positive' }),

  deadlineType: Joi.string()
    .valid('FIXED', 'TENTATIVE', 'TBD', 'NONE')
    .optional()
    .default('NONE'),

  deadline: Joi.string().isoDate().optional()
    .messages({ 'string.isoDate': 'deadline must be a valid ISO datetime' }),

  deadlineNote: Joi.string().allow('').optional(),
}).custom((value, helpers) => {
  if (value.isInternal && (value.maxMarks === undefined || value.maxMarks === null)) {
    return helpers.message({ custom: 'maxMarks is required when isInternal is true' });
  }
  if (!value.isInternal && value.maxMarks !== undefined) {
    return helpers.message({ custom: 'maxMarks is not allowed when isInternal is false' });
  }

  if (value.deadlineType === 'FIXED') {
    if (!value.deadline) {
      return helpers.message({ custom: 'deadline is required when deadlineType is FIXED' });
    }
    if (new Date(value.deadline) <= new Date()) {
      return helpers.message({ custom: 'FIXED deadline must be in the future' });
    }
  }

  if (value.deadlineType !== 'FIXED' && value.deadline) {
    return helpers.message({ custom: 'deadline is only allowed when deadlineType is FIXED' });
  }

  if (value.deadlineNote && !['TENTATIVE', 'TBD'].includes(value.deadlineType)) {
    return helpers.message({ custom: 'deadlineNote is only allowed for TENTATIVE or TBD deadline types' });
  }

  return value;
});
