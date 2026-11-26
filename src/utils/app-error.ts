export interface AppErrorOptions {
  statusCode: number;
  code: string;
  message: string;
  isOperational?: boolean;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.isOperational = options.isOperational ?? true;
    this.details = options.details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Los datos enviados no cumplen el contrato requerido.', details?: unknown) {
    super({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message,
      details,
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Autenticacion requerida o credenciales invalidas.') {
    super({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'No cuenta con permisos suficientes para realizar esta accion.') {
    super({
      statusCode: 403,
      code: 'FORBIDDEN',
      message,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'El recurso solicitado no fue encontrado.') {
    super({
      statusCode: 404,
      code: 'NOT_FOUND',
      message,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflicto de estado con un recurso existente.', details?: unknown) {
    super({
      statusCode: 409,
      code: 'CONFLICT',
      message,
      details,
    });
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Se ha excedido el limite de peticiones permitidas. Intente mas tarde.') {
    super({
      statusCode: 429,
      code: 'TOO_MANY_REQUESTS',
      message,
    });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Servicio temporalmente no disponible.', details?: unknown) {
    super({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
      message,
      details,
    });
  }
}
