import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { disconnectDatabase } from '../../src/config/database.js';
import { envSchema } from '../../src/config/env.js';
import { disconnectRedis } from '../../src/config/redis.js';

interface HealthSuccessBody {
  success: boolean;
  data: {
    status: string;
    service: string;
    environment: string;
    timezone: string;
    timestamp: string;
    uptimeSeconds: number;
    dependencies: {
      database: {
        status: string;
        latencyMs: number;
      };
      redis: {
        status: string;
        latencyMs: number;
      };
    };
  };
}

interface StandardErrorBody {
  success: boolean;
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

interface OpenApiSpecBody {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, unknown>;
  components?: {
    schemas?: Record<string, unknown>;
  };
}

describe('Integracion Base D1-1: Salud, OpenAPI 3.1 y Perimetro de Seguridad', () => {
  afterAll(async () => {
    await Promise.all([disconnectRedis(), disconnectDatabase()]);
  });

  it('GET /api/v1/health responde 200 OK con PostgreSQL y Redis activos en zona America/Guatemala', async () => {
    const response = await request(app).get('/api/v1/health');
    const body = response.body as HealthSuccessBody;

    expect(response.status).toBe(200);
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-request-id']).toBeDefined();

    expect(body.success).toBe(true);
    expect(body.data.status).toBe('healthy');
    expect(body.data.service).toBe('crm-empresarial-backend');
    expect(body.data.timezone).toBe('America/Guatemala');
    expect(body.data.timestamp).toMatch(/-06:00$/);
    expect(body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);

    expect(body.data.dependencies.database.status).toBe('up');
    expect(body.data.dependencies.database.latencyMs).toBeGreaterThanOrEqual(0);

    expect(body.data.dependencies.redis.status).toBe('up');
    expect(body.data.dependencies.redis.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/docs.json entrega una especificacion OpenAPI 3.1.0 valida y documentada', async () => {
    const response = await request(app).get('/api/docs.json');
    const spec = response.body as OpenApiSpecBody;

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('CRM Comercial Empresarial - Backend API');
    expect(spec.paths['/api/v1/health']).toBeDefined();
    expect(spec.components?.schemas?.['HealthCheckResponse']).toBeDefined();
    expect(spec.components?.schemas?.['StandardErrorResponse']).toBeDefined();
  });

  it('Rutas inexistentes responden 404 con sobre estandar de error y cabeceras Helmet presentes', async () => {
    const customRequestId = 'req-test-404-correlation-2026';
    const response = await request(app)
      .get('/api/v1/recurso-no-existente')
      .set('X-Request-Id', customRequestId);

    const body = response.body as StandardErrorBody;

    expect(response.status).toBe(404);
    expect(response.headers['x-request-id']).toBe(customRequestId);

    // Verificacion de cabeceras de seguridad Helmet
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");

    // Verificacion de formato estandar de error
    expect(body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Ruta no encontrada: GET /api/v1/recurso-no-existente',
        requestId: customRequestId,
      },
    });
  });

  it('CORS bloquea origenes no incluidos en la lista blanca con 403 FORBIDDEN', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://sitio-malicioso.ejemplo.com');

    const body = response.body as StandardErrorBody;

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('Kill-switch de entorno bloquea WHATSAPP_PROVIDER=sandbox en produccion si ALLOW_SANDBOX_IN_PROD=false', () => {
    const blockedProdEnv = envSchema.safeParse({
      NODE_ENV: 'production',
      PORT: '4000',
      FRONTEND_ORIGIN: 'https://crm.empresa.gt',
      CORS_ALLOWED_ORIGINS: 'https://crm.empresa.gt',
      DATABASE_URL: 'postgresql://prod_user:prod_pass@db:5432/crm_prod?schema=public',
      DIRECT_URL: 'postgresql://prod_user:prod_pass@db:5432/crm_prod?schema=public',
      REDIS_URL: 'redis://redis:6379',
      JWT_ACCESS_SECRET: 'prod_random_hex_secret_99887766554433221100aabbccddeeff',
      CSRF_SECRET: 'prod_random_hex_csrf_11223344556677889900ffeeddccbbaa',
      WS_TICKET_SECRET: 'prod_random_hex_ws_ticket_55667788990011223344aabbccdd',
      WHATSAPP_PROVIDER: 'sandbox',
      ALLOW_SANDBOX_IN_PROD: 'false',
    });

    expect(blockedProdEnv.success).toBe(false);
  });
});
