import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    validated?: {
      body?: unknown;
      query?: unknown;
      params?: unknown;
    };
  }
}

const SAFE_REQUEST_ID_PATTERN = /^[a-zA-Z0-9._-]{8,128}$/;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingHeader = req.header('x-request-id');
  const requestId =
    incomingHeader && SAFE_REQUEST_ID_PATTERN.test(incomingHeader)
      ? incomingHeader
      : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
