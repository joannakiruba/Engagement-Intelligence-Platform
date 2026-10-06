import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

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

    if (property === 'query') {
      // Express 5 makes req.query getter-only; store validated result separately
      (req as any).validatedQuery = value;
    } else {
      req[property] = value;
    }
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

    if (property === 'query') {
      (req as any).validatedQuery = value;
    } else {
      req[property] = value;
    }
    next();
  };
}
