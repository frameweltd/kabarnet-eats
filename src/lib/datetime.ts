/**
 * All timestamps in the database are stored in UTC (Postgres timestamptz).
 * Without an explicit timeZone, browser Date formatting falls back to
 * whatever timezone the VIEWER'S device happens to be set to -- which
 * means the same order can show a different time to an admin, a hotel,
 * and a customer if their devices/browsers have different timezone
 * settings. Since this platform only operates in Kabarnet, Kenya, every
 * displayed time should always show Kenya time (Africa/Nairobi, UTC+3),
 * regardless of the viewer's own device settings.
 */

export function formatKenyaDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
