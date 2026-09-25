import Joi from 'joi';

const questionSchema = Joi.object({
  label: Joi.string().min(1).required().messages({ 'string.empty': 'Question label is required' }),
  maxScore: Joi.number().positive().required().messages({ 'number.positive': 'maxScore must be positive' }),
  sortOrder: Joi.number().integer().optional(),
});

const sectionSchema = Joi.object({
  title: Joi.string().min(1).required().messages({ 'string.empty': 'Section title is required' }),
  sortOrder: Joi.number().integer().optional(),
  weightage: Joi.number().min(0).max(100).optional(),
  questions: Joi.array().items(questionSchema).min(1).required()
    .messages({ 'array.min': 'Each section must have at least one question' }),
});

export const createAssessmentSchema = Joi.object({
  batchId: Joi.string().uuid().required().messages({ 'string.guid': 'batchId must be a valid UUID' }),
  title: Joi.string().min(1).required().messages({ 'string.empty': 'Title is required' }),
  type: Joi.string().valid('CODING_TEST', 'QUIZ', 'ASSIGNMENT', 'CONTEST').required(),
  assessmentDate: Joi.string().isoDate().required()
    .messages({ 'string.isoDate': 'assessmentDate must be a valid ISO datetime' }),
  maxScore: Joi.number().positive().optional(),
  sections: Joi.array().items(sectionSchema).optional(),
}).custom((value, helpers) => {
  if (value.sections && value.sections.length > 0) {
    const hasWeightage = value.sections.some((s: any) => s.weightage !== undefined);
    const allHaveWeightage = value.sections.every((s: any) => s.weightage !== undefined);

    if (hasWeightage && !allHaveWeightage) {
      return helpers.message({ custom: 'If any section has weightage, all sections must have weightage' });
    }

    if (hasWeightage && allHaveWeightage) {
      const total = value.sections.reduce((sum: number, s: any) => sum + (s.weightage ?? 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        return helpers.message({ custom: `Section weightages must total exactly 100%. Current total: ${total}%` });
      }
    }
  }
  return value;
});

export const updateAssessmentSchema = Joi.object({
  title: Joi.string().min(1).optional(),
  type: Joi.string().valid('CODING_TEST', 'QUIZ', 'ASSIGNMENT', 'CONTEST').optional(),
  assessmentDate: Joi.string().isoDate().optional()
    .messages({ 'string.isoDate': 'assessmentDate must be a valid ISO datetime' }),
});

export const addSectionSchema = Joi.object({
  title: Joi.string().min(1).required().messages({ 'string.empty': 'Section title is required' }),
  sortOrder: Joi.number().integer().optional(),
  weightage: Joi.number().min(0).max(100).optional(),
});

export const updateSectionSchema = Joi.object({
  title: Joi.string().min(1).optional(),
  sortOrder: Joi.number().integer().optional(),
  weightage: Joi.number().min(0).max(100).optional(),
});

export const addQuestionSchema = Joi.object({
  label: Joi.string().min(1).required().messages({ 'string.empty': 'Question label is required' }),
  maxScore: Joi.number().positive().required().messages({ 'number.positive': 'maxScore must be positive' }),
  sortOrder: Joi.number().integer().optional(),
});

export const updateQuestionSchema = Joi.object({
  label: Joi.string().min(1).optional(),
  maxScore: Joi.number().positive().optional(),
  sortOrder: Joi.number().integer().optional(),
});

export const submitScoresSchema = Joi.object({
  studentId: Joi.string().uuid().required().messages({ 'string.guid': 'studentId must be a valid UUID' }),
  questionScores: Joi.array().items(
    Joi.object({
      questionId: Joi.string().uuid().required().messages({ 'string.guid': 'questionId must be a valid UUID' }),
      score: Joi.number().min(0).required().messages({ 'number.min': 'Score cannot be negative' }),
    })
  ).min(1).required().messages({ 'array.min': 'At least one question score is required' }),
  remarks: Joi.string().optional().allow(''),
});
