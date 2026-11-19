import React from 'react';
import {
  BarChart3,
  BookOpen,
  Flame,
  FolderOpen,
  Pin,
  Settings,
  StickyNote,
} from 'lucide-react';
import type { Course, DailyStudyLog } from '@shared/types';
import type { ActiveRoute } from './TitleBar';
import { computeStudySummary } from '@/lib/analytics';
import { getAccentClasses, getCourseStats } from '@/lib/courseHelpers';
import { formatHumanDuration } from '@/lib/format';

interface NavRailProps {
  route: ActiveRoute;
  courses: Course[];
  activeCourseId: string | null;
  studyLogs: Record<string, DailyStudyLog>;
  dailyGoalMinutes: number;
  onNavigate: (route: ActiveRoute) => void;
  onOpenCourse: (courseId: string) => void;
  onOpenImport: () => void;
}

export const NavRail: React.FC<NavRailProps> = ({
  route,
  courses,
  activeCourseId,
  studyLogs,
  dailyGoalMinutes,
  onNavigate,
  onOpenCourse,
  onOpenImport,
}) => {
  const summary = computeStudySummary(studyLogs, dailyGoalMinutes);
  const goalSecs = Math.max(60, dailyGoalMinutes * 60);
  const goalPct = Math.min(100, Math.round((summary.todaySeconds / goalSecs) * 100));

  const pinnedCourses = courses.filter((c) => c.pinned);
  const recentCourses = [...courses]
    .filter((c) => !c.pinned)
    .sort((a, b) => (b.lastOpenedAt || b.createdAt).localeCompare(a.lastOpenedAt || a.createdAt))
    .slice(0, 6);

  const navItems: Array<{
    id: ActiveRoute;
    label: string;
    shortcut: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      id: 'library',
      label: 'Course Library',
      shortcut: '⌘1',
      icon: <BookOpen className="size-4" strokeWidth={1.6} />,
      badge: courses.length,
    },
    {
      id: 'notes',
      label: 'Notes & Bookmarks',
      shortcut: '⌘2',
      icon: <StickyNote className="size-4" strokeWidth={1.6} />,
    },
    {
      id: 'activity',
      label: 'Study Activity',
      shortcut: '⌘3',
      icon: <BarChart3 className="size-4" strokeWidth={1.6} />,
    },
    {
      id: 'settings',
      label: 'Preferences',
      shortcut: '⌘,',
      icon: <Settings className="size-4" strokeWidth={1.6} />,
    },
  ];

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-panel select-none">
      {/* Primary Navigation */}
      <nav className="border-b border-line p-2.5">
        <div className="mb-1.5 px-2 font-mono text-[10px] tracking-wider text-fg-muted uppercase">
          Workspace
        </div>
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = route === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`group flex w-full items-center justify-between border px-2.5 py-2 text-left text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? 'border-ink bg-mint text-ink shadow-[2px_2px_0_0_var(--color-teal)]'
                    : 'border-transparent text-fg hover:border-line hover:bg-panel-head'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.5 font-mono text-[10px] leading-none ${
                        isActive
                          ? 'bg-ink text-ivory'
                          : 'bg-panel-head text-fg-muted'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Daily Study Goal & Streak Card */}
      <div className="border-b border-line p-3">
        <div className="border border-line bg-panel-head p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider text-fg-muted uppercase">
              Daily Goal
            </span>
            <span className="inline-flex items-center gap-1 border border-ink/20 bg-peach/35 px-1.5 py-0.5 font-mono text-[10px] font-medium text-fg">
              <Flame className="size-2.5 text-ink" strokeWidth={2} />
              {summary.currentStreak}d
            </span>
          </div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-semibold tabular-nums text-fg">
              {formatHumanDuration(summary.todaySeconds)}
            </span>
            <span className="font-mono text-[10px] text-fg-muted">
              / {dailyGoalMinutes}m target
            </span>
          </div>
          <div className="h-2 w-full border border-line-strong bg-panel bg-hatch">
            <div
              className="h-full bg-teal transition-all duration-300"
              style={{ width: `${goalPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Course Quick-Jump List */}
      <div className="flex-1 overflow-y-auto p-2.5">
        {pinnedCourses.length > 0 && (
          <div className="mb-3">
            <div className="mb-1.5 flex items-center gap-1 px-2 font-mono text-[10px] tracking-wider text-fg-muted uppercase">
              <Pin className="size-2.5" strokeWidth={1.8} />
              Pinned
            </div>
            <div className="space-y-0.5">
              {pinnedCourses.map((course) => {
                const stats = getCourseStats(course);
                const accent = getAccentClasses(course.accent);
                const isSelected = route === 'player' && activeCourseId === course.id;
                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => onOpenCourse(course.id)}
                    className={`flex w-full items-center gap-2 border px-2 py-1.5 text-left text-xs transition cursor-pointer ${
                      isSelected
                        ? 'border-line-strong bg-[var(--active-row)] font-medium text-fg'
                        : 'border-transparent text-fg-muted hover:border-line hover:bg-panel-head hover:text-fg'
                    }`}
                  >
                    <span className={`size-2 shrink-0 border border-ink/40 ${accent.dot}`} />
                    <span className="min-w-0 flex-1 truncate">{course.title}</span>
                    <span className="font-mono text-[10px] text-fg-muted">
                      {stats.progressPercent}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between px-2">
            <span className="font-mono text-[10px] tracking-wider text-fg-muted uppercase">
              Courses
            </span>
            <button
              type="button"
              onClick={onOpenImport}
              title="Add course folder"
              className="text-fg-muted hover:text-highlight cursor-pointer"
            >
              <FolderOpen className="size-3" strokeWidth={1.6} />
            </button>
          </div>

          {recentCourses.length === 0 && pinnedCourses.length === 0 ? (
            <div className="mx-1 border border-dashed border-line-strong bg-hatch p-3 text-center">
              <p className="text-[11px] text-fg-muted">No local courses imported yet.</p>
              <button
                type="button"
                onClick={onOpenImport}
                className="mt-2 text-[11px] font-medium text-highlight underline underline-offset-2 cursor-pointer"
              >
                Pick a folder →
              </button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {recentCourses.map((course) => {
                const stats = getCourseStats(course);
                const accent = getAccentClasses(course.accent);
                const isSelected = route === 'player' && activeCourseId === course.id;
                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => onOpenCourse(course.id)}
                    className={`flex w-full items-center gap-2 border px-2 py-1.5 text-left text-xs transition cursor-pointer ${
                      isSelected
                        ? 'border-line-strong bg-[var(--active-row)] font-medium text-fg'
                        : 'border-transparent text-fg-muted hover:border-line hover:bg-panel-head hover:text-fg'
                    }`}
                  >
                    <span className={`size-2 shrink-0 border border-ink/40 ${accent.dot}`} />
                    <span className="min-w-0 flex-1 truncate">{course.title}</span>
                    <span className="font-mono text-[10px] text-fg-muted">
                      {stats.progressPercent}%
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom architectural hatch strip */}
      <div className="border-t border-line bg-hatch px-3 py-2">
        <div className="flex items-center justify-between bg-panel px-2 py-1 border border-line font-mono text-[10px] text-fg-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-teal" />
            Local LMS
          </span>
          <span>Offline</span>
        </div>
      </div>
    </aside>
  );
};
