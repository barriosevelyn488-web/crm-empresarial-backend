import type { NextFunction, Request, Response } from 'express';
import { AppError, NotFoundError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';

export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId ?? 'unknown';

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(
        { err, requestId, method: req.method, path: req.originalUrl, code: err.code },
        err.message,
      );
    } else {
      logger.warn(
        { requestId, method: req.method, path: req.originalUrl, code: err.code },
        err.message,
      );
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        requestId,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status?: unknown }).status === 400 &&
    'body' in err
  ) {
    logger.warn(
      { requestId, method: req.method, path: req.originalUrl },
      'Cuerpo JSON malformado en la peticion.',
    );

    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON_PAYLOAD',
        message: 'El cuerpo JSON enviado tiene un formato sintactico invalido.',
        requestId,
      },
    });
    return;
  }

  logger.error(
    { err, requestId, method: req.method, path: req.originalUrl },
    'Error interno no controlado en el servidor.',
  );

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ha ocurrido un error interno inesperado.',
      requestId,
    },
  });
}
