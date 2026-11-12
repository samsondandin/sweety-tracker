import type { Request, Response, NextFunction } from 'express';
import { ReportsService } from '../services/reports.service.js';
import { getTodayForTimezone } from '../services/readings.service.js';

export class ReportsController {
  static async getReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const timezone = (req.headers['x-timezone'] as string) || 'UTC';
      const selectedDate = (req.query.date as string) || getTodayForTimezone(timezone);

      const report = await ReportsService.generateReport(userId, selectedDate);
      res.status(200).json(report);
    } catch (err) {
      next(err);
    }
  }
}

