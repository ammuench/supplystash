import { DateTime, Settings } from "luxon";

import { daysUntil, formatDate, isExpired, isExpiringSoon, parseIso } from "@/lib/dates";

// Pin both the clock and the zone: daysUntil counts calendar days, so the
// answers depend on the machine's timezone as well as the current time.
const NOW = DateTime.fromISO("2026-08-29T12:00:00Z");
const originalZone = Settings.defaultZone;

beforeAll(() => {
  Settings.now = () => NOW.toMillis();
  Settings.defaultZone = "utc";
});

afterAll(() => {
  Settings.now = () => Date.now();
  Settings.defaultZone = originalZone;
});

describe("# parseIso", () => {
  it("returns null for empty and malformed input", () => {
    expect(parseIso(null)).toBeNull();
    expect(parseIso(undefined)).toBeNull();
    expect(parseIso("not-a-date")).toBeNull();
  });
});

describe("# formatDate", () => {
  it("falls back to an em dash when there is no date", () => {
    expect(formatDate(null)).toBe("—");
  });
});

describe("# daysUntil", () => {
  it("counts calendar days, not 24-hour spans", () => {
    // Later the same day is still 0 days out.
    expect(daysUntil("2026-08-29T23:00:00Z")).toBe(0);
    expect(daysUntil("2026-08-31T01:00:00Z")).toBe(2);
    expect(daysUntil("2026-08-27T23:00:00Z")).toBe(-2);
  });
});

describe("# expiry states", () => {
  it("treats today as not yet expired", () => {
    expect(isExpired("2026-08-29T01:00:00Z")).toBe(false);
    expect(isExpiringSoon("2026-08-29T01:00:00Z")).toBe(true);
  });

  it("marks past dates expired and no longer expiring soon", () => {
    expect(isExpired("2026-08-20T12:00:00Z")).toBe(true);
    expect(isExpiringSoon("2026-08-20T12:00:00Z")).toBe(false);
  });

  it("respects the window boundary", () => {
    expect(isExpiringSoon("2026-09-05T12:00:00Z")).toBe(true);
    expect(isExpiringSoon("2026-09-06T12:00:00Z")).toBe(false);
    expect(isExpiringSoon("2026-09-06T12:00:00Z", 30)).toBe(true);
  });
});
