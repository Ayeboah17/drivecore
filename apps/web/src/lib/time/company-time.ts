export function companyDate(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GH", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function formatTime(instant: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GH", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant));
}
export function formatDay(instant: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GH", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(instant));
}
export function isDueSoon(instant: string, now: string) {
  const difference = Date.parse(instant) - Date.parse(now);
  return difference >= 0 && difference <= 120 * 60_000;
}
export function timeBand(
  item: { scheduledAt: string; outstanding: boolean },
  now: string,
) {
  return item.outstanding && Date.parse(item.scheduledAt) < Date.parse(now)
    ? 0
    : isDueSoon(item.scheduledAt, now)
      ? 1
      : 2;
}
