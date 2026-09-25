import Joi from 'joi';

export const createBatchSchema = Joi.object({
  name: Joi.string().min(1).required()
    .messages({ 'string.empty': 'Batch name is required' }),
  department: Joi.string().optional(),
  startDate: Joi.string().isoDate().required()
    .messages({ 'string.isoDate': 'startDate must be a valid ISO datetime' }),
  endDate: Joi.string().isoDate().optional()
    .messages({ 'string.isoDate': 'endDate must be a valid ISO datetime' }),
  description: Joi.string().optional(),
});

export const updateBatchSchema = Joi.object({
  name: Joi.string().min(1).optional(),
  department: Joi.string().optional(),
  startDate: Joi.string().isoDate().optional()
    .messages({ 'string.isoDate': 'startDate must be a valid ISO datetime' }),
  endDate: Joi.string().isoDate().optional()
    .messages({ 'string.isoDate': 'endDate must be a valid ISO datetime' }),
  description: Joi.string().optional(),
});

export const assignStudentSchema = Joi.object({
  studentId: Joi.string().uuid().required()
    .messages({ 'string.guid': 'studentId must be a valid UUID' }),
});

export const assignTrainerSchema = Joi.object({
  trainerId: Joi.string().uuid().required()
    .messages({ 'string.guid': 'trainerId must be a valid UUID' }),
});

export const createSessionSchema = Joi.object({
  trainerId: Joi.string().uuid().required()
    .messages({ 'string.guid': 'trainerId must be a valid UUID' }),
  title: Joi.string().min(1).required()
    .messages({ 'string.empty': 'Session title is required' }),
  topic: Joi.string().optional(),
  scheduledDate: Joi.string().isoDate().required()
    .messages({ 'string.isoDate': 'scheduledDate must be a valid ISO datetime' }),
  startTime: Joi.string().isoDate().required()
    .messages({ 'string.isoDate': 'startTime must be a valid ISO datetime' }),
  endTime: Joi.string().isoDate().required()
    .messages({ 'string.isoDate': 'endTime must be a valid ISO datetime' }),
}).custom((value, helpers) => {
  if (value.startTime && value.endTime) {
    if (new Date(value.endTime) <= new Date(value.startTime)) {
      return helpers.message({ custom: 'endTime must be after startTime' });
    }
  }
  return value;
});

export const updateSessionSchema = Joi.object({
  trainerId: Joi.string().uuid().optional()
    .messages({ 'string.guid': 'trainerId must be a valid UUID' }),
  title: Joi.string().min(1).optional(),
  topic: Joi.string().optional(),
  scheduledDate: Joi.string().isoDate().optional()
    .messages({ 'string.isoDate': 'scheduledDate must be a valid ISO datetime' }),
  startTime: Joi.string().isoDate().optional()
    .messages({ 'string.isoDate': 'startTime must be a valid ISO datetime' }),
  endTime: Joi.string().isoDate().optional()
    .messages({ 'string.isoDate': 'endTime must be a valid ISO datetime' }),
}).custom((value, helpers) => {
  if (value.startTime && value.endTime) {
    if (new Date(value.endTime) <= new Date(value.startTime)) {
      return helpers.message({ custom: 'endTime must be after startTime' });
    }
  }
  return value;
});
