import { describe, expect, it } from "vitest";

import { summarizeReadings, validateReading, type GlucoseReading } from "@/lib/glucose";

const today = "2026-11-11";

function reading(id: string, date: string, slot: string, value: number): GlucoseReading {
  return { id, reading_date: date, time_slot: slot, value };
}

describe("glucose reading rules", () => {
  it("requires a value", () => {
    expect(validateReading("", today, "morning", [], today)).toBe("Please enter a glucose value.");
  });

  it("accepts only whole-number readings from 40 through 600 mg/dl", () => {
    expect(validateReading("39", today, "morning", [], today)).toBe(
      "Value must be between 40 and 600 mg/dl.",
    );
    expect(validateReading("600", today, "morning", [], today)).toBeNull();
    expect(validateReading("105.5", today, "morning", [], today)).toBe(
      "Value must be between 40 and 600 mg/dl.",
    );
  });

  it("blocks future dates", () => {
    expect(validateReading("105", "2026-11-12", "morning", [], today)).toBe(
      "Date cannot be in the future.",
    );
  });

  it("allows only one reading in the same slot and date", () => {
    const existing = [reading("one", today, "after_lunch", 120)];
    expect(validateReading("125", today, "after_lunch", existing, today)).toBe(
      "You already have an After lunch reading for this date.",
    );
  });

  it("caps each day at four readings", () => {
    const existing = [
      reading("one", today, "morning", 98),
      reading("two", today, "after_breakfast", 125),
      reading("three", today, "after_lunch", 120),
      reading("four", today, "after_dinner", 112),
    ];
    expect(validateReading("115", today, "morning", existing, today)).toBe(
      "You can add only 4 readings per day.",
    );
  });

  it("summarizes readings with a one-decimal average and a friendly empty result", () => {
    expect(summarizeReadings([reading("one", today, "morning", 100), reading("two", today, "after_lunch", 121)])).toEqual({
      highest: 121,
      lowest: 100,
      average: 110.5,
      count: 2,
    });
    expect(summarizeReadings([])).toEqual({ highest: null, lowest: null, average: null, count: 0 });
  });
});