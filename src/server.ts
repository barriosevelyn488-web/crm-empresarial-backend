import { createServer, type Server } from 'node:http';
import { app } from './app.js';
import { disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { disconnectRedis } from './config/redis.js';
import { logger } from './utils/logger.js';

const httpServer: Server = createServer(app);
let isShuttingDown = false;

function closeHttpServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function gracefulShutdown(signal: string, exitCode = 0): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info({ signal }, 'Iniciando apagado controlado (Graceful Shutdown) del servidor.');

  const forceExitTimer = setTimeout(() => {
    logger.error('Tiempo maximo de apagado agotado (10s). Forzando salida del proceso.');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  try {
    await closeHttpServer(httpServer);
    logger.info('Servidor HTTP cerrado y sin conexiones entrantes nuevas.');

    await Promise.allSettled([disconnectRedis(), disconnectDatabase()]);

    logger.info('Apagado controlado finalizado limpiamente.');
    process.exit(exitCode);
  } catch (error) {
    logger.error({ err: error }, 'Error durante la secuencia de apagado controlado.');
    process.exit(1);
  }
}

httpServer.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      environment: env.NODE_ENV,
      timezone: env.TZ,
      whatsappProvider: env.WHATSAPP_PROVIDER,
      docsUrl: `http://localhost:${String(env.PORT)}/api/docs`,
    },
    'Servidor CRM Empresarial Backend escuchando conexiones.',
  );
});

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT', 0);
});

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM', 0);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.fatal({ err: reason }, 'Promesa rechazada no controlada detectada.');
  void gracefulShutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (error: Error) => {
  logger.fatal({ err: error }, 'Excepcion sincrona no controlada detectada.');
  void gracefulShutdown('uncaughtException', 1);
});

export { httpServer };
