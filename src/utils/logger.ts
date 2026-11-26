import pino from 'pino';
import { env } from '../config/env.js';

const redactedPaths: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-integration-key"]',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  'password',
  'contrasena',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'cookie',
  'cookies',
  '*.password',
  '*.contrasena',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.cookie',
  '*.cookies',
];

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  base: {
    service: 'crm-empresarial-backend',
    env: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: redactedPaths,
    censor: '[REDACTED]',
  },
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});
