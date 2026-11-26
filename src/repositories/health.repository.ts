import { performance } from 'node:perf_hooks';
import { prisma } from '../config/database.js';
import { redisClient } from '../config/redis.js';

export interface DependencyCheckResult {
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
}

export class HealthRepository {
  public async checkDatabase(): Promise<DependencyCheckResult> {
    const start = performance.now();

    try {
      await prisma.$queryRaw`SELECT 1 AS alive`;
      const latencyMs = Number((performance.now() - start).toFixed(2));
      return {
        status: 'up',
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Number((performance.now() - start).toFixed(2));
      return {
        status: 'down',
        latencyMs,
        error: error instanceof Error ? error.message : 'Fallo desconocido al consultar PostgreSQL.',
      };
    }
  }

  public async checkRedis(): Promise<DependencyCheckResult> {
    const start = performance.now();

    try {
      const response = await redisClient.ping();
      const latencyMs = Number((performance.now() - start).toFixed(2));

      if (response !== 'PONG') {
        return {
          status: 'down',
          latencyMs,
          error: `Respuesta inesperada de Redis PING: ${String(response)}`,
        };
      }

      return {
        status: 'up',
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Number((performance.now() - start).toFixed(2));
      return {
        status: 'down',
        latencyMs,
        error: error instanceof Error ? error.message : 'Fallo desconocido al consultar Redis.',
      };
    }
  }
}

export const healthRepository = new HealthRepository();
