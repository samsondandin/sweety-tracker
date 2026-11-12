import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation error
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    const message = firstIssue?.message || 'Invalid input data.';
    res.status(400).json({ error: message, message });
    return;
  }

  // Application domain error
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, message: err.message });
    return;
  }

  // PostgreSQL unique violation: user_id + reading_date + time_slot
  if (err.code === '23505') {
    const detail = err.detail || '';
    const slotMatch = detail.match(/\(([^)]+)\)=\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
    const slotName = slotMatch ? slotMatch[4] : 'selected';
    const message = `You already have an ${slotName} reading for this date.`;
    res.status(409).json({ error: message, message });
    return;
  }

  // PostgreSQL trigger / check constraint: max 4 readings or value bounds
  if (err.code === '23514' || err.code === '22007' || err.code === 'P0001') {
    if (err.message?.includes('4 readings')) {
      const message = 'You can add only 4 readings per day.';
      res.status(400).json({ error: message, message });
      return;
    }
    if (err.message?.includes('between 40 and 600')) {
      const message = 'Value must be between 40 and 600 mg/dl.';
      res.status(400).json({ error: message, message });
      return;
    }
    if (err.message?.includes('future')) {
      const message = 'Date cannot be in the future.';
      res.status(400).json({ error: message, message });
      return;
    }
  }

  console.error('Unhandled server error:', err);
  const fallbackMessage = 'An unexpected server error occurred.';
  res.status(500).json({ error: fallbackMessage, message: fallbackMessage });
}

