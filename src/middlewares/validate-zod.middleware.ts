import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { ValidationError } from '../utils/app-error.js';

export interface RequestValidationSchemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

export interface FormattedValidationIssue {
  location: 'body' | 'query' | 'params';
  path: string;
  message: string;
}

export function validateZod(schemas: RequestValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const issues: FormattedValidationIssue[] = [];
    const validatedPayload: NonNullable<Request['validated']> = {};

    if (schemas.params) {
      const parsedParams = schemas.params.safeParse(req.params);
      if (!parsedParams.success) {
        for (const issue of parsedParams.error.issues) {
          issues.push({
            location: 'params',
            path: issue.path.join('.'),
            message: issue.message,
          });
        }
      } else {
        validatedPayload.params = parsedParams.data;
      }
    }

    if (schemas.query) {
      const parsedQuery = schemas.query.safeParse(req.query);
      if (!parsedQuery.success) {
        for (const issue of parsedQuery.error.issues) {
          issues.push({
            location: 'query',
            path: issue.path.join('.'),
            message: issue.message,
          });
        }
      } else {
        validatedPayload.query = parsedQuery.data;
      }
    }

    if (schemas.body) {
      const parsedBody = schemas.body.safeParse(req.body);
      if (!parsedBody.success) {
        for (const issue of parsedBody.error.issues) {
          issues.push({
            location: 'body',
            path: issue.path.join('.'),
            message: issue.message,
          });
        }
      } else {
        req.body = parsedBody.data;
        validatedPayload.body = parsedBody.data;
      }
    }

    if (issues.length > 0) {
      next(new ValidationError('Error de validacion en los datos de entrada.', issues));
      return;
    }

    req.validated = validatedPayload;
    next();
  };
}
