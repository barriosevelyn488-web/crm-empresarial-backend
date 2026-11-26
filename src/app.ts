import cookieParser from 'cookie-parser';
import express, { type Express, type Request } from 'express';
import { pinoHttp } from 'pino-http';
import { corsMiddleware } from './config/cors.js';
import { env } from './config/env.js';
import { helmetMiddleware } from './config/helmet.js';
import { mountSwaggerDocs } from './config/swagger.js';
import {
  errorHandlerMiddleware,
  notFoundMiddleware,
} from './middlewares/error-handler.middleware.js';
import { apiRateLimiter } from './middlewares/rate-limit.middleware.js';
import { requestIdMiddleware } from './middlewares/request-id.middleware.js';
import { apiV1Router } from './routes/index.js';
import { logger } from './utils/logger.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  // 1. Correlacion de trazabilidad y registro HTTP estructurado
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as Request).requestId,
      autoLogging: env.NODE_ENV !== 'test',
    }),
  );

  // 2. Perimetro de seguridad HTTP (Helmet + CORS estricto + Cookies + Limites de cuerpo)
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 3. Especificacion OpenAPI 3.1 interactiva y JSON
  mountSwaggerDocs(app);

  // 4. Rutas versionadas de negocio protegidas por limite de tasa
  app.use('/api', apiRateLimiter);
  app.use('/api/v1', apiV1Router);

  // 5. Captura de rutas inexistentes (404) y manejador centralizado de errores
  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}

export const app: Express = createApp();
