import { StreakDay, StreakDayStatus, UserStreak } from './streak.models';

interface BuildStreakCalendarInput {
  year: number;
  month: number;
  today: Date;
  getDayStatus: (date: Date) => StreakDayStatus;
}

interface ComputeLiveStreakInput {
  firstRecordDate: Date;
  today: Date;
  todayKey: string;
  currentLongest: number;
  freezeUsed: boolean;
  getDayStatus: (date: Date) => StreakDayStatus;
}

interface ComputeTestingStreakInput {
  currentStreak: UserStreak;
  today: Date;
  todayKey: string;
  parseDateKey: (dateKey: string) => Date | null;
  daysBetween: (from: Date, to: Date) => number;
}

interface ComputeTestingStreakOutput {
  streak: UserStreak;
  inferredFirstRecordDate: Date | null;
}

export function buildStreakCalendarDays(
  input: BuildStreakCalendarInput,
): StreakDay[] {
  const { year, month, today, getDayStatus } = input;
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const normalizedToday = startOfDay(today);
  const days: StreakDay[] = [];

  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push({
      day: null,
      date: null,
      isDisabled: false,
      isSuccess: false,
      isSkipped: false,
      isFailed: false,
      isBeforeStart: false,
      isToday: false,
      isStreakStart: false,
    });
  }

  // Check the status of the last day of the previous month to determine
  // whether the first success day of this month is a streak start.
  let prevDayWasSuccess = false;
  if (daysInMonth > 0) {
    const lastDayPrevMonth = startOfDay(new Date(year, month, 0));
    if (lastDayPrevMonth <= normalizedToday) {
      prevDayWasSuccess = getDayStatus(lastDayPrevMonth) === 'success';
    }
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = startOfDay(new Date(year, month, day));
    const status = getDayStatus(date);
    const isSuccess = status === 'success';
    const isStreakStart = isSuccess && !prevDayWasSuccess;
    prevDayWasSuccess = isSuccess;

    days.push({
      day,
      date,
      isDisabled: date > normalizedToday,
      isSuccess,
      isSkipped: status === 'skipped',
      isFailed: status === 'failed',
      isBeforeStart: status === 'before-start',
      isToday: date.getTime() === normalizedToday.getTime(),
      isStreakStart,
    });
  }

  return days;
}

export function computeLiveStreakState(
  input: ComputeLiveStreakInput,
): UserStreak {
  const {
    firstRecordDate,
    today,
    todayKey,
    currentLongest,
    freezeUsed,
    getDayStatus,
  } = input;
  let runningCurrent = 0;
  let runningLongest = 0;
  const cursor = startOfDay(new Date(firstRecordDate));
  const normalizedToday = startOfDay(today);

  while (cursor <= normalizedToday) {
    const status = getDayStatus(cursor);
    if (status === 'success') {
      runningCurrent += 1;
      runningLongest = Math.max(runningLongest, runningCurrent);
    } else if (status === 'skipped' || status === 'failed') {
      runningCurrent = 0;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    current: runningCurrent,
    longest: Math.max(currentLongest, runningLongest),
    lastActiveDate: todayKey,
    freezeUsed,
  };
}

export function computeTestingModeStreakState(
  input: ComputeTestingStreakInput,
): ComputeTestingStreakOutput {
  const { currentStreak, today, todayKey, parseDateKey, daysBetween } = input;
  const lastActive = currentStreak.lastActiveDate
    ? parseDateKey(currentStreak.lastActiveDate)
    : null;

  let nextCurrent = Math.max(0, currentStreak.current);
  let nextLastActiveDate = currentStreak.lastActiveDate || todayKey;

  if (!lastActive) {
    nextCurrent = Math.max(1, nextCurrent || 1);
    nextLastActiveDate = todayKey;
  } else {
    const diff = daysBetween(lastActive, today);
    if (diff > 0) {
      nextCurrent += diff;
      nextLastActiveDate = todayKey;
    } else if (diff === 0) {
      nextLastActiveDate = todayKey;
    }
  }

  return {
    streak: {
      current: nextCurrent,
      longest: Math.max(currentStreak.longest, nextCurrent),
      lastActiveDate: nextLastActiveDate,
      freezeUsed: currentStreak.freezeUsed,
    },
    inferredFirstRecordDate: lastActive ?? startOfDay(today),
  };
}

export function normalizeUserStreak(value: unknown): UserStreak {
  if (!value || typeof value !== 'object') {
    return {
      current: 0,
      longest: 0,
      lastActiveDate: '',
      freezeUsed: false,
    };
  }

  const raw = value as Partial<UserStreak>;
  return {
    current: Math.max(0, Math.floor(raw.current || 0)),
    longest: Math.max(0, Math.floor(raw.longest || 0)),
    lastActiveDate: raw.lastActiveDate || '',
    freezeUsed: Boolean(raw.freezeUsed),
  };
}

export function getStreakMilestoneLabel(current: number): string {
  if (current >= 100) return 'Legenda';
  if (current >= 30) return 'Master Keuangan';
  if (current >= 7) return 'Seminggu Solid';
  if (current >= 3) return 'Mulai Konsisten';
  return 'Pemanasan';
}

function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}
