import { query } from '../config/db.js';
import { AppError } from '../middleware/error.middleware.js';

export const VALID_SLOTS = [
  'Morning (fasting)',
  'After breakfast',
  'After lunch',
  'After dinner'
] as const;

export type TimeSlot = (typeof VALID_SLOTS)[number];

const SLOT_MAPPING: Record<string, TimeSlot> = {
  morning: 'Morning (fasting)',
  'Morning (fasting)': 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  'After breakfast': 'After breakfast',
  after_lunch: 'After lunch',
  'After lunch': 'After lunch',
  after_dinner: 'After dinner',
  'After dinner': 'After dinner'
};

export function normalizeTimeSlot(slot: string): TimeSlot {
  const normalized = SLOT_MAPPING[slot];
  if (!normalized) {
    throw new AppError('Invalid time slot. Must be Morning (fasting), After breakfast, After lunch, or After dinner.', 400);
  }
  return normalized;
}

export function getTodayForTimezone(timezone = 'UTC'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date()); // Formats as YYYY-MM-DD
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export interface GlucoseReadingRow {
  id: string;
  user_id: string;
  reading_date: string;
  time_slot: TimeSlot;
  value_mg_dl: number;
  value?: number;
  created_at: string;
  updated_at: string;
}

export class ReadingsService {
  static validateReadingInput(
    rawValue: any,
    readingDate: string,
    userTimezone = 'UTC'
  ): { value: number; readingDate: string } {
    if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
      throw new AppError('Please enter a glucose value.', 400);
    }

    const numValue = Number(rawValue);
    if (!Number.isInteger(numValue) || numValue < 40 || numValue > 600) {
      throw new AppError('Value must be between 40 and 600 mg/dl.', 400);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(readingDate)) {
      throw new AppError('Invalid date format. Expected YYYY-MM-DD.', 400);
    }

    const today = getTodayForTimezone(userTimezone);
    if (readingDate > today) {
      throw new AppError('Date cannot be in the future.', 400);
    }

    return { value: numValue, readingDate };
  }

  static async listReadings(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
      readingDate?: string;
    } = {}
  ): Promise<{ data: GlucoseReadingRow[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['user_id = $1'];
    const params: any[] = [userId];

    if (options.readingDate) {
      params.push(options.readingDate);
      conditions.push(`reading_date = $${params.length}`);
    } else {
      if (options.startDate) {
        params.push(options.startDate);
        conditions.push(`reading_date >= $${params.length}`);
      }
      if (options.endDate) {
        params.push(options.endDate);
        conditions.push(`reading_date <= $${params.length}`);
      }
    }

    const whereClause = conditions.join(' AND ');

    // Total count for pagination
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM glucose_readings WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Paginated results ordered by date descending, then time slot
    params.push(limit);
    const limitIndex = params.length;
    params.push(offset);
    const offsetIndex = params.length;

    const result = await query<GlucoseReadingRow>(
      `SELECT id, user_id, TO_CHAR(reading_date, 'YYYY-MM-DD') AS reading_date,
              time_slot, value_mg_dl, value_mg_dl AS value, created_at, updated_at
       FROM glucose_readings
       WHERE ${whereClause}
       ORDER BY reading_date DESC, created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params
    );

    return {
      data: result.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  static async createReading(
    userId: string,
    input: {
      reading_date: string;
      time_slot: string;
      value_mg_dl: any;
      timezone?: string;
    }
  ): Promise<GlucoseReadingRow> {
    const { value, readingDate } = this.validateReadingInput(
      input.value_mg_dl,
      input.reading_date,
      input.timezone
    );
    const timeSlot = normalizeTimeSlot(input.time_slot);

    // Check daily limit (max 4 per day)
    const countCheck = await query<{ count: string }>(
      'SELECT COUNT(*) FROM glucose_readings WHERE user_id = $1 AND reading_date = $2',
      [userId, readingDate]
    );
    if (parseInt(countCheck.rows[0]?.count || '0', 10) >= 4) {
      throw new AppError('You can add only 4 readings per day.', 400);
    }

    // Check duplicate slot on same date
    const duplicateCheck = await query(
      'SELECT id FROM glucose_readings WHERE user_id = $1 AND reading_date = $2 AND time_slot = $3',
      [userId, readingDate, timeSlot]
    );
    if (duplicateCheck.rows.length > 0) {
      throw new AppError(`You already have an ${timeSlot} reading for this date.`, 409);
    }

    const insertResult = await query<GlucoseReadingRow>(
      `INSERT INTO glucose_readings (user_id, reading_date, time_slot, value_mg_dl)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, TO_CHAR(reading_date, 'YYYY-MM-DD') AS reading_date,
                 time_slot, value_mg_dl, value_mg_dl AS value, created_at, updated_at`,
      [userId, readingDate, timeSlot, value]
    );

    return insertResult.rows[0];
  }

  static async updateReading(
    userId: string,
    readingId: string,
    input: {
      reading_date?: string;
      time_slot?: string;
      value_mg_dl?: any;
      timezone?: string;
    }
  ): Promise<GlucoseReadingRow> {
    // Check reading exists and belongs to user
    const existing = await query<GlucoseReadingRow>(
      `SELECT id, user_id, TO_CHAR(reading_date, 'YYYY-MM-DD') AS reading_date,
              time_slot, value_mg_dl
       FROM glucose_readings
       WHERE id = $1 AND user_id = $2`,
      [readingId, userId]
    );

    if (existing.rows.length === 0) {
      throw new AppError('Reading not found.', 404);
    }

    const current = existing.rows[0];
    const targetDate = input.reading_date ?? current.reading_date;
    const targetSlot = input.time_slot ? normalizeTimeSlot(input.time_slot) : current.time_slot;
    const targetValueRaw = input.value_mg_dl !== undefined ? input.value_mg_dl : current.value_mg_dl;

    const { value, readingDate } = this.validateReadingInput(
      targetValueRaw,
      targetDate,
      input.timezone
    );

    // If date changed, enforce 4 readings limit on target date
    if (readingDate !== current.reading_date) {
      const countCheck = await query<{ count: string }>(
        'SELECT COUNT(*) FROM glucose_readings WHERE user_id = $1 AND reading_date = $2 AND id <> $3',
        [userId, readingDate, readingId]
      );
      if (parseInt(countCheck.rows[0]?.count || '0', 10) >= 4) {
        throw new AppError('You can add only 4 readings per day.', 400);
      }
    }

    // Check duplicate slot on target date (excluding current reading)
    const duplicateCheck = await query(
      `SELECT id FROM glucose_readings
       WHERE user_id = $1 AND reading_date = $2 AND time_slot = $3 AND id <> $4`,
      [userId, readingDate, targetSlot, readingId]
    );
    if (duplicateCheck.rows.length > 0) {
      throw new AppError(`You already have an ${targetSlot} reading for this date.`, 409);
    }

    const updateResult = await query<GlucoseReadingRow>(
      `UPDATE glucose_readings
       SET reading_date = $3,
           time_slot = $4,
           value_mg_dl = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, TO_CHAR(reading_date, 'YYYY-MM-DD') AS reading_date,
                 time_slot, value_mg_dl, value_mg_dl AS value, created_at, updated_at`,
      [readingId, userId, readingDate, targetSlot, value]
    );

    return updateResult.rows[0];
  }

  static async deleteReading(userId: string, readingId: string): Promise<void> {
    const result = await query(
      'DELETE FROM glucose_readings WHERE id = $1 AND user_id = $2 RETURNING id',
      [readingId, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Reading not found.', 404);
    }
  }
}

