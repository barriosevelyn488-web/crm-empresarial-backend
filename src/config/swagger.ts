import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';
import type { Express, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const openApiRegistry = new OpenAPIRegistry();

export const StandardErrorResponseSchema = openApiRegistry.register(
  'StandardErrorResponse',
  z.object({
    success: z.literal(false).openapi({ example: false }),
    error: z.object({
      code: z.string().openapi({ example: 'NOT_FOUND' }),
      message: z.string().openapi({ example: 'El recurso solicitado no fue encontrado.' }),
      requestId: z.string().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
      details: z.unknown().optional(),
    }),
  }),
);

export const DependencyStatusSchema = z.object({
  status: z.enum(['up', 'down']).openapi({ example: 'up' }),
  latencyMs: z.number().nonnegative().openapi({ example: 2.45 }),
  error: z.string().optional(),
});

export const HealthCheckResponseSchema = openApiRegistry.register(
  'HealthCheckResponse',
  z.object({
    success: z.boolean().openapi({ example: true }),
    data: z.object({
      status: z.enum(['healthy', 'degraded']).openapi({ example: 'healthy' }),
      service: z.string().openapi({ example: 'crm-empresarial-backend' }),
      environment: z.enum(['development', 'test', 'production']).openapi({ example: 'development' }),
      timezone: z.string().openapi({ example: 'America/Guatemala' }),
      timestamp: z.string().openapi({ example: '2026-11-26T06:55:00.000-06:00' }),
      uptimeSeconds: z.number().nonnegative().openapi({ example: 42.18 }),
      dependencies: z.object({
        database: DependencyStatusSchema,
        redis: DependencyStatusSchema,
      }),
    }),
  }),
);

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/health',
  tags: ['Infraestructura y Salud'],
  summary: 'Verifica conectividad activa con PostgreSQL 16 y Redis 7',
  description:
    'Ejecuta SELECT 1 contra PostgreSQL y PING contra Redis midiendo latencia real en milisegundos.',
  responses: {
    200: {
      description: 'Todos los subsistemas criticos responden dentro de parametros operativos.',
      content: {
        'application/json': {
          schema: HealthCheckResponseSchema,
        },
      },
    },
    503: {
      description: 'Uno o mas subsistemas criticos (PostgreSQL o Redis) se encuentran degradados.',
      content: {
        'application/json': {
          schema: HealthCheckResponseSchema,
        },
      },
    },
  },
});

export function buildOpenApiDocument(): ReturnType<OpenApiGeneratorV31['generateDocument']> {
  const generator = new OpenApiGeneratorV31(openApiRegistry.definitions);

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'CRM Comercial Empresarial - Backend API',
      version: '0.1.0',
      description:
        'Especificacion OpenAPI 3.1 generada desde esquemas Zod para la arquitectura Cliente-Servidor en N-Capas.',
    },
    servers: [
      {
        url: '/',
        description: 'Servidor activo',
      },
    ],
  });
}

export function mountSwaggerDocs(app: Express): void {
  const openApiDocument = buildOpenApiDocument();

  app.get('/api/docs.json', (_req: Request, res: Response) => {
    res.status(200).json(openApiDocument);
  });

  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      explorer: false,
      customSiteTitle: 'CRM Empresarial API Docs',
    }),
  );
}
