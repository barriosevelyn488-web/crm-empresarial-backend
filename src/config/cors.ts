import cors, { type CorsOptions } from 'cors';
import { env } from './env.js';
import { ForbiddenError } from '../utils/app-error.js';

const allowedOriginsSet = new Set<string>(env.CORS_ALLOWED_ORIGINS);

export const corsOptions: CorsOptions = {
  origin(requestOrigin, callback) {
    // Permite herramientas servidor-a-servidor, healthchecks y pruebas Supertest sin cabecera Origin
    if (!requestOrigin) {
      callback(null, true);
      return;
    }

    if (allowedOriginsSet.has(requestOrigin)) {
      callback(null, true);
      return;
    }

    callback(new ForbiddenError(`Origen CORS no autorizado: ${requestOrigin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-Id',
    'X-CSRF-Token',
    'X-Integration-Key',
    'X-Idempotency-Key',
  ],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 600,
};

export const corsMiddleware = cors(corsOptions);
