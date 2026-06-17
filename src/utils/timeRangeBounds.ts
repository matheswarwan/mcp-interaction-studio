const ONE_DAY = 86_400_000;
const ONE_WEEK = 7 * ONE_DAY;
const ONE_MONTH = 30 * ONE_DAY;
const ONE_QUARTER = 90 * ONE_DAY;

function getCurrentBucket(bucketSizeMillis: number): number {
  const now = Date.now();
  return now - (now % bucketSizeMillis);
}

/** Convert a time_range string to epoch ms start/end for campaignStats. */
export function timeRangeToBounds(timeRange: string): { start: number; end: number } {
  const bucketEnd = getCurrentBucket(ONE_DAY);

  switch (timeRange) {
    case "pastDay":
      return { start: bucketEnd - ONE_DAY, end: bucketEnd };
    case "pastWeek":
      return { start: bucketEnd - ONE_WEEK, end: bucketEnd };
    case "pastMonth":
      return { start: bucketEnd - ONE_MONTH, end: bucketEnd };
    case "pastQuarter":
      return { start: bucketEnd - ONE_QUARTER, end: bucketEnd };
    case "Today": {
      const startOfDay = Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate()
      );
      return { start: startOfDay, end: Date.now() };
    }
    default: {
      if (timeRange.includes("..")) {
        const [startStr, endStr] = timeRange.split("..");
        const start = Date.parse(`${startStr}T00:00:00.000Z`);
        const end = Date.parse(`${endStr}T23:59:59.999Z`);
        if (Number.isNaN(start) || Number.isNaN(end)) {
          throw new Error(
            `Invalid time_range "${timeRange}". Use pastDay, pastWeek, pastMonth, pastQuarter, Today, or YYYY-MM-DD..YYYY-MM-DD`
          );
        }
        return { start, end };
      }
      throw new Error(
        `Invalid time_range "${timeRange}". Use pastDay, pastWeek, pastMonth, pastQuarter, Today, or YYYY-MM-DD..YYYY-MM-DD`
      );
    }
  }
}
