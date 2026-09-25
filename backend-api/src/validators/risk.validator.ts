import Joi from 'joi';

export const calculateStudentSchema = Joi.object({
  batchId: Joi.string().uuid().required().messages({
    'string.guid': 'batchId must be a valid UUID',
    'any.required': 'batchId is required',
  }),
});

export const studentIdParamSchema = Joi.object({
  studentId: Joi.string().uuid().required().messages({
    'string.guid': 'studentId must be a valid UUID',
  }),
});

export const batchIdParamSchema = Joi.object({
  batchId: Joi.string().uuid().required().messages({
    'string.guid': 'batchId must be a valid UUID',
  }),
});
