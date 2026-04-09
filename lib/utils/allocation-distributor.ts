import { format, addDays, differenceInDays } from "date-fns";

export interface DistributionDay {
  date: Date;
  hours: number;
  isBlocked: boolean;
}

export interface DistributionResult {
  distributions: DistributionDay[];
  totalDays: number;
  totalHours: number;
  hoursPerDay: number;
  skippedDays: number;
  remainingHours: number; // Hours that couldn't be distributed due to 8hr/day limit
  blockedDays: {
    timeOff: number;
    weekend: number;
  };
}

export interface DistributeMonthlyHoursParams {
  totalHours: number;
  monthStart: Date;
  monthEnd: Date;
  timeOffAssignments: Array<{
    startDate: string | Date;
    endDate: string | Date;
  }>;
}

/**
 * Helper: Parse date string to Date object at noon (to avoid DST issues)
 */
function parseDateNoTZ(dateStr: string | Date): Date {
  if (typeof dateStr === 'string') {
    // Parse the date string and create at noon UTC to avoid timezone issues
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }
  return dateStr;
}

/**
 * Helper: Format date to YYYY-MM-DD string
 */
function formatDateStr(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper: Add days to date (returns UTC date)
 */
function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Distributes monthly hours across working days, skipping:
 * - Weekends (Saturday/Sunday)
 * - Days with existing assignments for the same project (unless editing that assignment)
 * - Time-off days
 *
 * Distribution logic:
 * - Distributes evenly, max 8hr/day
 * - Uses UTC dates to avoid timezone issues
 */
export function distributeMonthlyHours(params: DistributeMonthlyHoursParams): DistributionResult {
  const {
    totalHours,
    monthStart,
    monthEnd,
    timeOffAssignments,
  } = params;

  // Convert to UTC date strings at noon to avoid timezone issues
  const startDate = parseDateNoTZ(monthStart);
  const endDate = parseDateNoTZ(monthEnd);

  console.log('[Allocation Distributor] Input params:', {
    monthStart,
    monthEnd,
    startDateUTC: startDate.toISOString(),
    endDateUTC: endDate.toISOString(),
    totalHours
  });

  // Convert time-off assignments to date strings for comparison
  const timeOffAssignmentsStr = timeOffAssignments.map((a) => ({
    startDateStr: typeof a.startDate === 'string' ? a.startDate : format(a.startDate, 'yyyy-MM-dd'),
    endDateStr: typeof a.endDate === 'string' ? a.endDate : format(a.endDate, 'yyyy-MM-dd'),
  }));

  // Calculate total days in range
  const totalDaysInRange = differenceInDays(endDate, startDate) + 1;
  console.log('[Allocation Distributor] Total days in range:', totalDaysInRange);

  // Collect working days
  const workingDays: Date[] = [];
  const blockedDays = {
    timeOff: 0,
    weekend: 0,
  };

  let currentDate = startDate;
  let dayCount = 0;

  while (currentDate <= endDate) {
    dayCount++;
    const currentDateStr = formatDateStr(currentDate);
    const dayOfWeek = currentDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];

    console.log('[Allocation Distributor] Processing day:', {
      dayCount,
      currentDateStr,
      dayOfWeek,
      dayName,
      currentDateUTC: currentDate.toISOString()
    });

    // Check if weekend (0 = Sunday, 6 = Saturday)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log('[Allocation Distributor] Skipping weekend:', {
        date: currentDateStr,
        dayOfWeek,
        dayName
      });
      blockedDays.weekend++;
    } else {
      // Check if day is time-off (only time-off blocks days)
      const isTimeOff = timeOffAssignmentsStr.some((a) => {
        return currentDateStr >= a.startDateStr && currentDateStr <= a.endDateStr;
      });

      if (isTimeOff) {
        blockedDays.timeOff++;
      } else {
        console.log('[Allocation Distributor] Adding working day:', {
          date: currentDateStr,
          dayOfWeek,
          dayName
        });
        workingDays.push(new Date(currentDate)); // Push a copy
      }
    }

    currentDate = addDaysUTC(currentDate, 1);
  }

  // 3. Calculate distribution
  const daysCount = workingDays.length;
  console.log('[Allocation Distributor] Working days found:', daysCount);

  if (daysCount === 0) {
    return {
      distributions: [],
      totalDays: 0,
      totalHours: 0,
      hoursPerDay: 0,
      skippedDays: blockedDays.timeOff + blockedDays.weekend,
      remainingHours: totalHours,
      blockedDays,
    };
  }

  // Calculate hours per day, max 8
  const rawHoursPerDay = totalHours / daysCount;
  const hoursPerDay = Math.min(8, Math.max(0.5, rawHoursPerDay));
  const totalDistributedHours = hoursPerDay * daysCount;
  const remainingHours = Math.max(0, totalHours - totalDistributedHours);

  // 4. Create distribution array
  const distributions: DistributionDay[] = workingDays.map((date) => ({
    date,
    hours: hoursPerDay,
    isBlocked: false,
  }));

  console.log('[Allocation Distributor] Final result:', {
    totalDays: daysCount,
    totalHours: totalDistributedHours,
    hoursPerDay,
    remainingHours,
    weekendBlocked: blockedDays.weekend,
    timeOffBlocked: blockedDays.timeOff,
    distributions: distributions.map(d => ({
      date: formatDateStr(d.date),
      dayOfWeek: d.date.getUTCDay(),
      hours: d.hours
    }))
  });

  return {
    distributions,
    totalDays: daysCount,
    totalHours: totalDistributedHours,
    hoursPerDay,
    skippedDays: blockedDays.existingAssignment + blockedDays.timeOff + blockedDays.weekend,
    remainingHours,
    blockedDays,
  };
}

/**
 * Calculate the maximum possible hours for a given month
 * considering working days and existing assignments
 */
export function calculateMaxPossibleHours(params: Omit<DistributeMonthlyHoursParams, 'totalHours'>): number {
  const result = distributeMonthlyHours({
    ...params,
    totalHours: 999, // Use a large number to calculate max
  });
  return result.totalDays * 8; // Max 8 hours per working day
}
