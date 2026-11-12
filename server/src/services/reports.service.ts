import { query } from '../config/db.js';
import { AppError } from '../middleware/error.middleware.js';
import { type GlucoseReadingRow } from './readings.service.js';

export interface MetricSummary {
  highest: number | null;
  lowest: number | null;
  average: number | null;
  count: number;
}

export interface DailyReport extends MetricSummary {
  date: string;
  formatted_range: string;
  readings: GlucoseReadingRow[];
}

export interface PeriodReport extends MetricSummary {
  start_date: string;
  end_date: string;
  formatted_range: string;
  readings_count_by_day?: Record<string, number>;
  daily_averages?: Array<{ date: string; average: number | null; count: number }>;
}

export interface ComprehensiveReport {
  selected_date: string;
  daily: DailyReport;
  month_to_date: PeriodReport;
  previous_month: PeriodReport;
}

function computeMetrics(values: number[]): MetricSummary {
  if (values.length === 0) {
    return {
      highest: null,
      lowest: null,
      average: null,
      count: 0
    };
  }

  const highest = Math.max(...values);
  const lowest = Math.min(...values);
  const sum = values.reduce((acc, curr) => acc + curr, 0);
  const average = Math.round((sum / values.length) * 10) / 10;

  return {
    highest,
    lowest,
    average,
    count: values.length
  };
}

function formatDisplayDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat('en-US', options ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(dateObj);
}

export class ReportsService {
  static getPreviousMonthBounds(year: number, month: number): { start: string; end: string } {
    let prevYear = year;
    let prevMonth = month - 1;

    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }

    const start = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    // Date(year, month, 0) gives the last day of previous month
    const lastDayOfMonth = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
    const end = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    return { start, end };
  }

  static async generateReport(userId: string, selectedDate: string): Promise<ComprehensiveReport> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      throw new AppError('Invalid date format. Expected YYYY-MM-DD.', 400);
    }

    const [year, month, _day] = selectedDate.split('-').map(Number);
    const mtdStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const mtdEnd = selectedDate;

    const prevMonthBounds = this.getPreviousMonthBounds(year, month);

    // Fetch all readings from previous month start up to selected date in one efficient query
    const results = await query<GlucoseReadingRow>(
      `SELECT id, user_id, TO_CHAR(reading_date, 'YYYY-MM-DD') AS reading_date,
              time_slot, value_mg_dl, value_mg_dl AS value, created_at, updated_at
       FROM glucose_readings
       WHERE user_id = $1
         AND (
           (reading_date >= $2 AND reading_date <= $3) -- Previous month
           OR
           (reading_date >= $4 AND reading_date <= $5) -- MTD including selected date
         )
       ORDER BY reading_date ASC, created_at ASC`,
      [userId, prevMonthBounds.start, prevMonthBounds.end, mtdStart, mtdEnd]
    );

    const allRows = results.rows;

    // 1. Daily Report for selectedDate
    const dailyRows = allRows.filter((r) => r.reading_date === selectedDate);
    const dailyMetrics = computeMetrics(dailyRows.map((r) => r.value_mg_dl));
    const dailyReport: DailyReport = {
      ...dailyMetrics,
      date: selectedDate,
      formatted_range: formatDisplayDate(selectedDate),
      readings: dailyRows
    };

    // 2. Month-to-Date Report (1st of month to selectedDate)
    const mtdRows = allRows.filter((r) => r.reading_date >= mtdStart && r.reading_date <= mtdEnd);
    const mtdMetrics = computeMetrics(mtdRows.map((r) => r.value_mg_dl));

    // Daily averages for MTD trend charting
    const mtdDays: Array<{ date: string; average: number | null; count: number }> = [];
    const mtdCursor = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
    const mtdStop = new Date(Date.UTC(year, month - 1, _day, 12, 0, 0));

    while (mtdCursor <= mtdStop) {
      const dStr = mtdCursor.toISOString().slice(0, 10);
      const rowsForDay = mtdRows.filter((r) => r.reading_date === dStr);
      const dayMetrics = computeMetrics(rowsForDay.map((r) => r.value_mg_dl));
      mtdDays.push({
        date: dStr,
        average: dayMetrics.average,
        count: dayMetrics.count
      });
      mtdCursor.setUTCDate(mtdCursor.getUTCDate() + 1);
    }

    const monthToDateReport: PeriodReport = {
      ...mtdMetrics,
      start_date: mtdStart,
      end_date: mtdEnd,
      formatted_range: `${formatDisplayDate(mtdStart, { day: 'numeric', month: 'short' })} – ${formatDisplayDate(mtdEnd)}`,
      daily_averages: mtdDays
    };

    // 3. Previous Month Report
    const prevMonthRows = allRows.filter(
      (r) => r.reading_date >= prevMonthBounds.start && r.reading_date <= prevMonthBounds.end
    );
    const prevMonthMetrics = computeMetrics(prevMonthRows.map((r) => r.value_mg_dl));

    const prevMonthDays: Array<{ date: string; average: number | null; count: number }> = [];
    const [pYear, pMonth] = prevMonthBounds.start.split('-').map(Number);
    const pLastDay = parseInt(prevMonthBounds.end.split('-')[2], 10);
    const pCursor = new Date(Date.UTC(pYear, pMonth - 1, 1, 12, 0, 0));
    const pStop = new Date(Date.UTC(pYear, pMonth - 1, pLastDay, 12, 0, 0));

    while (pCursor <= pStop) {
      const dStr = pCursor.toISOString().slice(0, 10);
      const rowsForDay = prevMonthRows.filter((r) => r.reading_date === dStr);
      const dayMetrics = computeMetrics(rowsForDay.map((r) => r.value_mg_dl));
      prevMonthDays.push({
        date: dStr,
        average: dayMetrics.average,
        count: dayMetrics.count
      });
      pCursor.setUTCDate(pCursor.getUTCDate() + 1);
    }

    const previousMonthReport: PeriodReport = {
      ...prevMonthMetrics,
      start_date: prevMonthBounds.start,
      end_date: prevMonthBounds.end,
      formatted_range: `${formatDisplayDate(prevMonthBounds.start, { day: 'numeric', month: 'short' })} – ${formatDisplayDate(prevMonthBounds.end)}`,
      daily_averages: prevMonthDays
    };

    return {
      selected_date: selectedDate,
      daily: dailyReport,
      month_to_date: monthToDateReport,
      previous_month: previousMonthReport
    };
  }
}

