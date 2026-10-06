import Joi from 'joi';

export const createAssignmentSchema = Joi.object({
  mentorId: Joi.string().uuid().required(),
  studentId: Joi.string().uuid().required(),
});
