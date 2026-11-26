import { env } from '../config/env.js';
import {
  healthRepository,
  type DependencyCheckResult,
  type HealthRepository,
} from '../repositories/health.repository.js';

export const GUATEMALA_TIMEZONE = 'America/Guatemala';

export interface SystemHealthReport {
  healthy: boolean;
  status: 'healthy' | 'degraded';
  service: string;
  environment: 'development' | 'test' | 'production';
  timezone: string;
  timestamp: string;
  uptimeSeconds: number;
  dependencies: {
    database: DependencyCheckResult;
    redis: DependencyCheckResult;
  };
}

function formatGuatemalaIsoTimestamp(date: Date): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: GUATEMALA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false,
  });

  // sv-SE produce YYYY-MM-DD HH:mm:ss.SSS; Guatemala mantiene UTC-06:00 permanente sin DST
  const formattedLocal = formatter.format(date).replace(' ', 'T').replace(',', '.');
  return `${formattedLocal}-06:00`;
}

export class HealthService {
  private readonly repository: HealthRepository;

  constructor(repository: HealthRepository = healthRepository) {
    this.repository = repository;
  }

  public async getSystemHealth(): Promise<SystemHealthReport> {
    const [database, redis] = await Promise.all([
      this.repository.checkDatabase(),
      this.repository.checkRedis(),
    ]);

    const healthy = database.status === 'up' && redis.status === 'up';

    return {
      healthy,
      status: healthy ? 'healthy' : 'degraded',
      service: 'crm-empresarial-backend',
      environment: env.NODE_ENV,
      timezone: GUATEMALA_TIMEZONE,
      timestamp: formatGuatemalaIsoTimestamp(new Date()),
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      dependencies: {
        database,
        redis,
      },
    };
  }
}

export const healthService = new HealthService();
