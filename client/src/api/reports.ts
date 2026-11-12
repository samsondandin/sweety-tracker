import { apiRequest } from './client';
import { type GlucoseReading, type MetricSummary } from '../lib/glucose';

export interface DailyReport extends MetricSummary {
  date: string;
  formatted_range: string;
  readings: GlucoseReading[];
}

export interface PeriodReport extends MetricSummary {
  start_date: string;
  end_date: string;
  formatted_range: string;
  daily_averages?: Array<{ date: string; average: number | null; count: number }>;
}

export interface ComprehensiveReport {
  selected_date: string;
  daily: DailyReport;
  month_to_date: PeriodReport;
  previous_month: PeriodReport;
}

export const reportsApi = {
  async getReport(date: string): Promise<ComprehensiveReport> {
    return apiRequest<ComprehensiveReport>(`/reports?date=${encodeURIComponent(date)}`);
  }
};

