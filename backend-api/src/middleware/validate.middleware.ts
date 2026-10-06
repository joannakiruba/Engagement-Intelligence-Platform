import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// Express 5 makes req.query a read-only getter, so we can't reassign it directly.
function applyValidated(req: Request, property: 'body' | 'query' | 'params', value: Record<string, unknown>) {
  if (property === 'query') {
    const target = req[property] as Record<string, unknown>;
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, value);
  } else {
    req[property] = value;
  }
}

export function validate(schema: Joi.ObjectSchema, property: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((d) => d.message).join('; ');
      res.status(400).json({ success: false, error: messages });
      return;
    }

    applyValidated(req, property, value);
    next();
  };
}

export function validateStrict(schema: Joi.ObjectSchema, property: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      const messages = error.details.map((d) => d.message).join('; ');
      res.status(400).json({ success: false, error: messages });
      return;
    }

    applyValidated(req, property, value);
    next();
  };
}
