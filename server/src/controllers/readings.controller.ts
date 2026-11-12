import type { Request, Response, NextFunction } from 'express';
import { ReadingsService } from '../services/readings.service.js';

export class ReadingsController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
      const readingDate = req.query.readingDate ? String(req.query.readingDate) : undefined;

      const result = await ReadingsService.listReadings(userId, {
        page,
        limit,
        startDate,
        endDate,
        readingDate
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const timezone = (req.headers['x-timezone'] as string) || req.body.timezone || 'UTC';
      const valueRaw = req.body.value_mg_dl !== undefined ? req.body.value_mg_dl : req.body.value;

      const reading = await ReadingsService.createReading(userId, {
        reading_date: req.body.reading_date,
        time_slot: req.body.time_slot,
        value_mg_dl: valueRaw,
        timezone
      });

      res.status(201).json({ data: reading, reading });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const readingId = req.params.id;
      const timezone = (req.headers['x-timezone'] as string) || req.body.timezone || 'UTC';
      const valueRaw = req.body.value_mg_dl !== undefined ? req.body.value_mg_dl : req.body.value;

      const reading = await ReadingsService.updateReading(userId, readingId, {
        reading_date: req.body.reading_date,
        time_slot: req.body.time_slot,
        value_mg_dl: valueRaw,
        timezone
      });

      res.status(200).json({ data: reading, reading });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const readingId = req.params.id;

      await ReadingsService.deleteReading(userId, readingId);
      res.status(200).json({ message: 'Reading removed.' });
    } catch (err) {
      next(err);
    }
  }
}

