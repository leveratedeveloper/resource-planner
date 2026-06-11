import { addDays, startOfDay } from "date-fns";

export function isTimelineV2Weekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function countTimelineV2Workdays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  const normalizedEnd = startOfDay(end);

  while (startOfDay(current) <= normalizedEnd) {
    if (!isTimelineV2Weekend(current)) count += 1;
    current.setDate(current.getDate() + 1);
  }

  return Math.max(1, count);
}

export function getTimelineV2DragRange(startIndex: number, endIndex: number) {
  const start = Math.min(startIndex, endIndex);
  const end = Math.max(startIndex, endIndex);

  return { start, end, length: end - start + 1 };
}

export function offsetTimelineV2Date(date: Date, days: number) {
  return addDays(date, days);
}
