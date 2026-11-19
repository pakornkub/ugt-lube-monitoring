// SQL Server has no array type: list columns (site_access, tags, menu_main, …) are
// JSON arrays stored in NVarChar(Max). These two helpers are the only readers/writers.

/** Parse a JSON string[] column. Bad/empty data reads as [] (never throws on a page). */
export function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Serialize a string[] for a JSON list column. */
export function toList(values: readonly string[] | null | undefined): string {
  return JSON.stringify(values ?? []);
}

/** A DATE column as the 'YYYY-MM-DD' string the app's row types use. */
export function dateOnly(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** 'YYYY-MM-DD' (or '') from a form → a DATE column value. */
export function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(`${s.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
