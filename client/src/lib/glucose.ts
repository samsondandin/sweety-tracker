export const READING_SLOTS = [
  { id: 'Morning (fasting)', label: 'Morning · fasting', shortLabel: 'Morning' },
  { id: 'After breakfast', label: 'After breakfast', shortLabel: 'Breakfast' },
  { id: 'After lunch', label: 'After lunch', shortLabel: 'Lunch' },
  { id: 'After dinner', label: 'After dinner', shortLabel: 'Dinner' }
] as const;

export type ReadingSlot = (typeof READING_SLOTS)[number]['id'];

export interface GlucoseReading {
  id: string;
  user_id?: string;
  reading_date: string;
  time_slot: string;
  value_mg_dl: number;
  value?: number;
  created_at?: string;
  updated_at?: string;
}

export interface MetricSummary {
  highest: number | null;
  lowest: number | null;
  average: number | null;
  count: number;
}

export function validateReading(
  rawValue: string,
  readingDate: string,
  slot: string,
  existing: GlucoseReading[],
  today: string,
  excludeReadingId?: string
): string | null {
  if (!rawValue || !rawValue.trim()) {
    return 'Please enter a glucose value.';
  }

  const num = Number(rawValue.trim());
  if (!/^\d+$/.test(rawValue.trim()) || num < 40 || num > 600) {
    return 'Value must be between 40 and 600 mg/dl.';
  }

  if (readingDate > today) {
    return 'Date cannot be in the future.';
  }

  const daily = existing.filter(
    (reading) => reading.reading_date === readingDate && reading.id !== excludeReadingId
  );

  if (daily.length >= 4) {
    return 'You can add only 4 readings per day.';
  }

  if (daily.some((reading) => reading.time_slot === slot)) {
    return `You already have an ${slot} reading for this date.`;
  }

  return null;
}

export function summarizeReadings(readings: GlucoseReading[]): MetricSummary {
  if (readings.length === 0) {
    return { highest: null, lowest: null, average: null, count: 0 };
  }

  const values = readings.map((r) => r.value_mg_dl ?? r.value ?? 0);
  const total = values.reduce((sum, v) => sum + v, 0);

  return {
    highest: Math.max(...values),
    lowest: Math.min(...values),
    average: Math.round((total / values.length) * 10) / 10,
    count: readings.length
  };
}

export function getSlotLabel(slot: string): string {
  const found = READING_SLOTS.find((item) => item.id === slot || item.shortLabel.toLowerCase() === slot.toLowerCase());
  return found ? found.label : slot;
}

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(date: string, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return '';
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat('en-US', options ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

