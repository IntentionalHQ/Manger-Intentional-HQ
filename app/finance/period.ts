export function currentAccountingPeriod(
  date = new Date(),
  timeZone = process.env.HQ_TIME_ZONE || "America/New_York",
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const year = Number(value("year"));
  const month = Number(value("month"));
  const day = Number(value("day"));
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
  const asOfDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone }).format(date);
  return { start, end, label, asOfDate };
}

