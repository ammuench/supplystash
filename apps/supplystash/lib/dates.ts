import { DateTime } from "luxon";

// Inventory dates arrive from Postgres as ISO strings (`timestamptz` and
// `date`). Parsing lives here so call sites never touch DateTime directly and
// the app has one answer for "is this expired".

/** Parse an ISO string from the database. Returns null for null/invalid input. */
export const parseIso = (iso: string | null | undefined): DateTime | null => {
  if (!iso) return null;
  const parsed = DateTime.fromISO(iso);
  return parsed.isValid ? parsed : null;
};

/** Serialize for writing back to Postgres. */
export const toIso = (date: DateTime): string => date.toISO() ?? "";

/** "Aug 29, 2026" — the default for showing a date in the UI. */
export const formatDate = (iso: string | null | undefined): string =>
  parseIso(iso)?.toLocaleString(DateTime.DATE_MED) ?? "—";

/** "in 3 days" / "2 months ago" — for expiry badges and activity feeds. */
export const formatRelative = (iso: string | null | undefined): string =>
  parseIso(iso)?.toRelative() ?? "—";

/**
 * Whole days until `iso`, negative once past. Uses calendar-day boundaries, not
 * 24-hour spans, so an item expiring late tonight reads as 0 days and not 1.
 */
export const daysUntil = (iso: string | null | undefined): number | null => {
  const parsed = parseIso(iso);
  if (!parsed) return null;
  return Math.round(parsed.startOf("day").diff(DateTime.now().startOf("day"), "days").days);
};

export const isExpired = (iso: string | null | undefined): boolean => {
  const days = daysUntil(iso);
  return days !== null && days < 0;
};

/** Expiring within `withinDays` but not yet expired — the "use me soon" state. */
export const isExpiringSoon = (iso: string | null | undefined, withinDays = 7): boolean => {
  const days = daysUntil(iso);
  return days !== null && days >= 0 && days <= withinDays;
};
