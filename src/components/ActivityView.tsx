import React, { useMemo } from 'react';
import {
  ArrowRight,
  Award,
  Calendar,
  Clock,
  Flame,
  TrendingUp,
} from 'lucide-react';
import type { Course, DailyStudyLog } from '@shared/types';
import { buildHeatmapWeeks, computeStudySummary } from '@/lib/analytics';
import { getAccentClasses, getCourseStats } from '@/lib/courseHelpers';
import { formatHumanDuration } from '@/lib/format';
import { CrosshairFrame } from './ui/CrosshairFrame';

interface ActivityViewProps {
  courses: Course[];
  studyLogs: Record<string, DailyStudyLog>;
  dailyGoalMinutes: number;
  onOpenCourse: (courseId: string) => void;
}

const HEATMAP_CELL_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-panel-head border-line',
  1: 'bg-mint-soft border-ink/15',
  2: 'bg-mint border-ink/25',
  3: 'bg-teal border-ink/30',
  4: 'bg-iris border-ink/40',
};

export const ActivityView: React.FC<ActivityViewProps> = ({
  courses,
  studyLogs,
  dailyGoalMinutes,
  onOpenCourse,
}) => {
  const summary = useMemo(
    () => computeStudySummary(studyLogs, dailyGoalMinutes),
    [studyLogs, dailyGoalMinutes],
  );
  const weeks = useMemo(
    () => buildHeatmapWeeks(studyLogs, 20, dailyGoalMinutes),
    [studyLogs, dailyGoalMinutes],
  );

  const goalSecs = Math.max(60, dailyGoalMinutes * 60);
  const todayPct = Math.min(100, Math.round((summary.todaySeconds / goalSecs) * 100));

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6 sm:px-8">
        <div className="border-b border-line pb-5">
          <div className="font-mono text-[10px] tracking-wider text-fg-muted uppercase">
            Learning Analytics
          </div>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-fg">
            Study Consistency &amp; Course Progress
          </h1>
          <p className="mt-1 text-xs text-fg-muted">
            Tracked privately on your Mac — every minute watched and lesson completed builds your
            streak.
          </p>
        </div>

        {/* Stat Strip */}
        <CrosshairFrame className="bg-panel">
          <div className="grid grid-cols-2 divide-x divide-y divide-line md:grid-cols-4 md:divide-y-0">
            <div className="p-4">
              <div className="flex items-center justify-between text-fg-muted">
                <span className="font-mono text-[10px] uppercase">Current Streak</span>
                <Flame className="size-4 text-peach" />
              </div>
              <div className="mt-1.5 text-2xl font-semibold tabular-nums text-fg">
                {summary.currentStreak}d
              </div>
              <div className="mt-0.5 text-[11px] text-fg-muted">
                Longest: {summary.longestStreak} days
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between text-fg-muted">
                <span className="font-mono text-[10px] uppercase">Today’s Goal</span>
                <TrendingUp className="size-4 text-highlight" />
              </div>
              <div className="mt-1.5 text-2xl font-semibold tabular-nums text-fg">
                {todayPct}%
              </div>
              <div className="mt-0.5 text-[11px] text-fg-muted">
                {formatHumanDuration(summary.todaySeconds)} / {dailyGoalMinutes}m
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between text-fg-muted">
                <span className="font-mono text-[10px] uppercase">Past 7 Days</span>
                <Clock className="size-4 text-teal" />
              </div>
              <div className="mt-1.5 text-2xl font-semibold tabular-nums text-fg">
                {formatHumanDuration(summary.weekSeconds)}
              </div>
              <div className="mt-0.5 text-[11px] text-fg-muted">
                Total: {formatHumanDuration(summary.totalSeconds)}
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between text-fg-muted">
                <span className="font-mono text-[10px] uppercase">Active Days</span>
                <Award className="size-4 text-highlight" />
              </div>
              <div className="mt-1.5 text-2xl font-semibold tabular-nums text-fg">
                {summary.activeDays}
              </div>
              <div className="mt-0.5 text-[11px] text-fg-muted">
                {summary.totalCompletedLogs} lessons finished
              </div>
            </div>
          </div>
        </CrosshairFrame>

        {/* 20-Week Study Activity Heatmap */}
        <section className="border border-line bg-panel p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-highlight" strokeWidth={1.6} />
              <h2 className="text-sm font-semibold text-fg">20-Week Study Heatmap</h2>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-fg-muted">
              <span>Less</span>
              {([0, 1, 2, 3, 4] as const).map((lvl) => (
                <span key={lvl} className={`size-3 border ${HEATMAP_CELL_CLASS[lvl]}`} />
              ))}
              <span>More</span>
            </div>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="inline-flex gap-1.5">
              {weeks.map((col, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-1.5">
                  {col.map((cell) => (
                    <div
                      key={cell.date}
                      title={`${cell.label}: ${formatHumanDuration(cell.secondsWatched)} watched · ${cell.lessonsCompleted} lessons completed`}
                      className={`size-4 border transition hover:scale-110 ${HEATMAP_CELL_CLASS[cell.level]}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Course Completion Breakdown */}
        <section className="border border-line bg-panel">
          <div className="border-b border-line bg-panel-head px-5 py-3">
            <h2 className="text-sm font-semibold text-fg">Course Progress Matrix</h2>
          </div>
          {courses.length === 0 ? (
            <div className="p-8 text-center text-xs text-fg-muted">
              Import a course folder to start tracking completion analytics.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {courses.map((course) => {
                const stats = getCourseStats(course);
                const accent = getAccentClasses(course.accent);
                return (
                  <div
                    key={course.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 hover:bg-panel-head/50"
                  >
                    <div className="min-w-[200px] flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`size-2.5 border border-ink/40 ${accent.dot}`} />
                        <span className="truncate text-sm font-medium text-fg">
                          {course.title}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-fg-muted">
                        {stats.completedLessons}/{stats.totalLessons} lessons · {stats.totalNotes}{' '}
                        notes · {stats.totalFlashcards} cards
                      </div>
                    </div>

                    <div className="flex w-52 items-center gap-3">
                      <div className="h-2 flex-1 border border-line-strong bg-panel-head bg-hatch">
                        <div
                          className={`h-full ${accent.bar}`}
                          style={{ width: `${stats.progressPercent}%` }}
                        />
                      </div>
                      <span className="w-9 text-right font-mono text-xs font-semibold text-fg">
                        {stats.progressPercent}%
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenCourse(course.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-highlight hover:underline cursor-pointer"
                    >
                      Open <ArrowRight className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
