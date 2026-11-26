import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy(times: number): number {
    return Math.min(times * 200, 3000);
  },
});

redisClient.on('connect', () => {
  logger.debug('Cliente Redis conectado al servidor.');
});

redisClient.on('error', (error: Error) => {
  logger.error({ err: error }, 'Error reportado por el cliente Redis.');
});

export async function disconnectRedis(): Promise<void> {
  if (redisClient.status === 'end') {
    return;
  }

  try {
    await redisClient.quit();
    logger.info('Conexion con Redis cerrada correctamente.');
  } catch (error) {
    logger.warn({ err: error }, 'Fallo cierre ordenado de Redis; forzando desconexion.');
    redisClient.disconnect();
  }
}
