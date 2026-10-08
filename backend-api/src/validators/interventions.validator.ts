import Joi from 'joi';

export const CAUSE_CODES = [
  'ATTENDANCE_DECLINE',
  'ASSESSMENT_UNDERPERFORMANCE',
  'FEEDBACK_CONCERN',
] as const;

export type CauseCode = (typeof CAUSE_CODES)[number];

export const createInterventionSchema = Joi.object({
  alertId: Joi.number().integer().positive().required(),
  causeCode: Joi.string()
    .valid(...CAUSE_CODES)
    .required(),
  title: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().max(5000).allow('').optional(),
  deadline: Joi.date().iso().greater('now').optional(),
});

export const updateInterventionSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).optional(),
  description: Joi.string().trim().max(5000).allow('').optional(),
  deadline: Joi.date().iso().optional().allow(null),
  status: Joi.string().valid('IN_PROGRESS', 'CANCELLED').optional(),
});

export const completeInterventionSchema = Joi.object({
  outcome: Joi.string().valid('IMPROVED', 'NO_CHANGE', 'DECLINED').required(),
  remarks: Joi.string().trim().max(2000).allow('').optional(),
  wasRecommendationFollowed: Joi.boolean().optional(),
});

export const editOutcomeSchema = Joi.object({
  outcome: Joi.string().valid('IMPROVED', 'NO_CHANGE', 'DECLINED').required(),
  remarks: Joi.string().trim().max(2000).allow('').optional(),
});

export const createTaskSchema = Joi.object({
  title: Joi.string().trim().min(1).max(300).required(),
  description: Joi.string().trim().max(3000).allow('').optional(),
  deadline: Joi.date().iso().optional().allow(null),
});

export const updateTaskSchema = Joi.object({
  title: Joi.string().trim().min(1).max(300).optional(),
  description: Joi.string().trim().max(3000).allow('').optional(),
  deadline: Joi.date().iso().optional().allow(null),
  isCompleted: Joi.boolean().optional(),
});

export const createNoteSchema = Joi.object({
  note: Joi.string().trim().min(1).max(5000).required(),
});

export const updateNoteSchema = Joi.object({
  note: Joi.string().trim().min(1).max(5000).required(),
});

export const listInterventionsSchema = Joi.object({
  status: Joi.string().valid('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED').optional(),
  studentId: Joi.string().uuid().optional(),
  hasOverdueTasks: Joi.string().valid('true', 'false').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
