export interface StreakDay {
  day: number | null;
  date: Date | null;
  isDisabled: boolean;
  isSuccess: boolean;
  isSkipped: boolean;
  isFailed: boolean;
  isBeforeStart: boolean;
  isToday: boolean;
  isStreakStart: boolean;
}

export type StreakDayStatus =
  | 'success'
  | 'skipped'
  | 'failed'
  | 'before-start'
  | 'future';

export interface UserStreak {
  current: number;
  longest: number;
  lastActiveDate: string;
  freezeUsed: boolean;
}
