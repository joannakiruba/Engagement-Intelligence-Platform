import Joi from 'joi';

export const previewQuerySchema = Joi.object({
  weekStart: Joi.date().iso().optional(),
  weekEnd: Joi.date().iso().optional(),
  mentorId: Joi.string().uuid().optional(),
});

export const triggerBodySchema = Joi.object({
  weekStart: Joi.date().iso().optional(),
  weekEnd: Joi.date().iso().optional(),
});
