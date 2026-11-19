import type { DailyStudyLog } from '@shared/types';
import { getTodayKey } from './format';

export interface HeatmapCell {
  date: string;
  label: string;
  secondsWatched: number;
  lessonsCompleted: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface StudySummary {
  currentStreak: number;
  longestStreak: number;
  todaySeconds: number;
  weekSeconds: number;
  totalSeconds: number;
  totalCompletedLogs: number;
  activeDays: number;
}

export function computeStudySummary(
  logs: Record<string, DailyStudyLog>,
  dailyGoalMinutes = 30,
): StudySummary {
  const todayKey = getTodayKey();
  const todaySeconds = logs[todayKey]?.secondsWatched ?? 0;

  let totalSeconds = 0;
  let totalCompletedLogs = 0;
  let activeDays = 0;

  const activeDateSet = new Set<string>();
  for (const [date, log] of Object.entries(logs)) {
    const secs = log.secondsWatched || 0;
    const comp = log.lessonsCompleted || 0;
    totalSeconds += secs;
    totalCompletedLogs += comp;
    if (secs >= 60 || comp > 0) {
      activeDays++;
      activeDateSet.add(date);
    }
  }

  // Last 7 days watch time
  let weekSeconds = 0;
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = getTodayKey(d);
    weekSeconds += logs[key]?.secondsWatched ?? 0;
  }

  // Current streak (counts today or yesterday if today not started yet)
  let currentStreak = 0;
  const cursor = new Date(now);
  if (!activeDateSet.has(getTodayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (activeDateSet.has(getTodayKey(cursor))) {
    currentStreak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Longest streak across all recorded dates
  const sortedDates = [...activeDateSet].sort();
  let longestStreak = 0;
  let run = 0;
  let prevTime = 0;
  for (const dateStr of sortedDates) {
    const t = new Date(`${dateStr}T12:00:00`).getTime();
    if (prevTime > 0 && Math.round((t - prevTime) / 86400000) === 1) {
      run++;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prevTime = t;
  }

  // Ensure dailyGoalMinutes is referenced nicely for future expansion
  void dailyGoalMinutes;

  return {
    currentStreak,
    longestStreak,
    todaySeconds,
    weekSeconds,
    totalSeconds,
    totalCompletedLogs,
    activeDays,
  };
}

export function buildHeatmapWeeks(
  logs: Record<string, DailyStudyLog>,
  weeks = 16,
  dailyGoalMinutes = 30,
): HeatmapCell[][] {
  const goalSecs = Math.max(300, dailyGoalMinutes * 60);
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  // Align grid so the rightmost column ends on Saturday of current week
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + (6 - today.getDay()));

  const totalDays = weeks * 7;
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - totalDays + 1);

  const grid: HeatmapCell[][] = [];
  const cursor = new Date(startDate);

  for (let w = 0; w < weeks; w++) {
    const col: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      const key = getTodayKey(cursor);
      const entry = logs[key];
      const secs = entry?.secondsWatched ?? 0;
      const comp = entry?.lessonsCompleted ?? 0;

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (secs > 0 || comp > 0) {
        const ratio = secs / goalSecs;
        if (ratio >= 1.2 || comp >= 3) level = 4;
        else if (ratio >= 0.75 || comp >= 2) level = 3;
        else if (ratio >= 0.35 || comp >= 1) level = 2;
        else level = 1;
      }

      col.push({
        date: key,
        label: cursor.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        secondsWatched: secs,
        lessonsCompleted: comp,
        level,
      });

      cursor.setDate(cursor.getDate() + 1);
    }
    grid.push(col);
  }

  return grid;
}
