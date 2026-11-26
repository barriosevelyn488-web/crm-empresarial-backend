import type { NextFunction, Request, Response } from 'express';
import { healthService, type HealthService } from '../services/health.service.js';

export class HealthController {
  private readonly service: HealthService;

  constructor(service: HealthService = healthService) {
    this.service = service;
  }

  public check = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = await this.service.getSystemHealth();
      const httpStatus = report.healthy ? 200 : 503;

      res.status(httpStatus).json({
        success: report.healthy,
        data: {
          status: report.status,
          service: report.service,
          environment: report.environment,
          timezone: report.timezone,
          timestamp: report.timestamp,
          uptimeSeconds: report.uptimeSeconds,
          dependencies: report.dependencies,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const healthController = new HealthController();
