import Joi from 'joi';

export const generateAlertsSchema = Joi.object({
  batchId: Joi.string().uuid().optional(),
});

export const updateAlertStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'seen', 'acted', 'dismissed').required(),
});

export const alertOutcomeSchema = Joi.object({
  mentor_response: Joi.string().valid('acted', 'dismissed', 'ignored').required(),
  response_time_hours: Joi.number().positive().optional(),
  intervention_id: Joi.string().uuid().optional(),
  was_recommendation_followed: Joi.boolean().required(),
  outcome_notes: Joi.string().max(1000).optional(),
});
