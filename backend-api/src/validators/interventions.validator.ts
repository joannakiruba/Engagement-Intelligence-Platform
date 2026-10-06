import Joi from 'joi';

export const createInterventionSchema = Joi.object({
  studentId: Joi.string().uuid().required(),
  riskScoreId: Joi.string().uuid().optional(),
  title: Joi.string().max(200).required(),
  description: Joi.string().max(2000).required(),
  deadline: Joi.date().iso().optional(),
});

export const updateInterventionSchema = Joi.object({
  title: Joi.string().max(200).optional(),
  description: Joi.string().max(2000).optional(),
  status: Joi.string().valid('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED').optional(),
  deadline: Joi.date().iso().allow(null).optional(),
});

export const interventionOutcomeSchema = Joi.object({
  outcome: Joi.string().valid('IMPROVED', 'NO_CHANGE', 'DECLINED').required(),
  remarks: Joi.string().max(2000).optional(),
});

export const interventionUpdateNoteSchema = Joi.object({
  note: Joi.string().max(2000).required(),
});
