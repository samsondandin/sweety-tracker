export const READING_SLOTS = [
  { id: "morning", label: "Morning · fasting", shortLabel: "Morning" },
  { id: "after_breakfast", label: "After breakfast", shortLabel: "Breakfast" },
  { id: "after_lunch", label: "After lunch", shortLabel: "Lunch" },
  { id: "after_dinner", label: "After dinner", shortLabel: "Dinner" },
] as const;

export type ReadingSlot = (typeof READING_SLOTS)[number]["id"];

export type GlucoseReading = {
  id: string;
  reading_date: string;
  time_slot: string;
  value: number;
};

export type ReportMetrics = {
  highest: number | null;
  lowest: number | null;
  average: number | null;
  count: number;
};

export function validateReading(
  rawValue: string,
  readingDate: string,
  slot: ReadingSlot,
  existing: GlucoseReading[],
  today: string,
  excludeReadingId?: string,
): string | null {
  if (!rawValue.trim()) return "Please enter a glucose value.";
  if (!/^\d+$/.test(rawValue.trim()) || Number(rawValue) < 40 || Number(rawValue) > 600) {
    return "Value must be between 40 and 600 mg/dl.";
  }
  if (readingDate > today) return "Date cannot be in the future.";

  const daily = existing.filter(
    (reading) => reading.reading_date === readingDate && reading.id !== excludeReadingId,
  );
  if (daily.length >= 4) return "You can add only 4 readings per day.";

  if (daily.some((reading) => reading.time_slot === slot)) {
    const label = READING_SLOTS.find((item) => item.id === slot)?.label ?? slot;
    return `You already have an ${label} reading for this date.`;
  }
  return null;
}

export function summarizeReadings(readings: GlucoseReading[]): ReportMetrics {
  if (readings.length === 0) return { highest: null, lowest: null, average: null, count: 0 };
  const values = readings.map((reading) => reading.value);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    highest: Math.max(...values),
    lowest: Math.min(...values),
    average: Math.round((total / values.length) * 10) / 10,
    count: readings.length,
  };
}

export function getSlotLabel(slot: string): string {
  return READING_SLOTS.find((item) => item.id === slot)?.label ?? slot;
}

export type ReportPeriod = "daily" | "month_to_date" | "previous_month";

export function getReportDateRange(period: ReportPeriod, selectedDate: string) {
  const [year, month, day] = selectedDate.split("-").map(Number);
  if (!year || !month || !day) return null;

  if (period === "daily") return { start: selectedDate, end: selectedDate };
  if (period === "month_to_date") {
    return {
      start: `${year}-${String(month).padStart(2, "0")}-01`,
      end: selectedDate,
    };
  }

  const previousMonthEnd = new Date(Date.UTC(year, month - 1, 0));
  const previousYear = previousMonthEnd.getUTCFullYear();
  const previousMonth = previousMonthEnd.getUTCMonth() + 1;
  const previousMonthStart = `${previousYear}-${String(previousMonth).padStart(2, "0")}-01`;
  const previousMonthEndDate = `${previousYear}-${String(previousMonth).padStart(2, "0")}-${String(previousMonthEnd.getUTCDate()).padStart(2, "0")}`;
  return { start: previousMonthStart, end: previousMonthEndDate };
}