import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pin,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  StickyNote,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Course, DailyStudyLog } from '@shared/types';
import { BrandMascotCard } from './BrandMark';
import { Button } from './ui/Button';
import { CrosshairFrame, CrosshairTick } from './ui/CrosshairFrame';
import { computeStudySummary } from '@/lib/analytics';
import {
  findLessonInCourse,
  getAccentClasses,
  getCourseStats,
} from '@/lib/courseHelpers';
import { formatDuration, formatHumanDuration, formatRelativeTime } from '@/lib/format';

interface LibraryViewProps {
  courses: Course[];
  studyLogs: Record<string, DailyStudyLog>;
  dailyGoalMinutes: number;
  onPickFolder: () => void;
  onDropFolderPath: (folderPath: string) => void;
  onOpenCourse: (courseId: string, lessonId?: string) => void;
  onTogglePin: (courseId: string) => void;
  onRescanCourse: (courseId: string) => void;
  onDeleteCourse: (courseId: string) => void;
}

type StatusFilter = 'all' | 'in-progress' | 'completed' | 'not-started';

export const LibraryView: React.FC<LibraryViewProps> = ({
  courses,
  studyLogs,
  dailyGoalMinutes,
  onPickFolder,
  onDropFolderPath,
  onOpenCourse,
  onTogglePin,
  onRescanCourse,
  onDeleteCourse,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const studySummary = useMemo(
    () => computeStudySummary(studyLogs, dailyGoalMinutes),
    [studyLogs, dailyGoalMinutes],
  );

  const aggregate = useMemo(() => {
    let totalLessons = 0;
    let completedLessons = 0;
    let totalNotes = 0;
    for (const c of courses) {
      const s = getCourseStats(c);
      totalLessons += s.totalLessons;
      completedLessons += s.completedLessons;
      totalNotes += s.totalNotes;
    }
    return { totalLessons, completedLessons, totalNotes };
  }, [courses]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of courses) {
      for (const t of c.tags) set.add(t);
    }
    return [...set].sort();
  }, [courses]);

  const resumeCourse = useMemo(() => {
    if (courses.length === 0) return null;
    const sorted = [...courses].sort((a, b) => {
      if (a.lastOpenedAt && !b.lastOpenedAt) return -1;
      if (!a.lastOpenedAt && b.lastOpenedAt) return 1;
      if (a.lastOpenedAt && b.lastOpenedAt && a.lastOpenedAt !== b.lastOpenedAt) {
        return b.lastOpenedAt.localeCompare(a.lastOpenedAt);
      }
      const sa = getCourseStats(a).progressPercent;
      const sb = getCourseStats(b).progressPercent;
      if (sa !== sb) return sb - sa;
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return sorted[0];
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses
      .filter((course) => {
        const stats = getCourseStats(course);
        if (statusFilter !== 'all' && stats.status !== statusFilter) return false;
        if (activeTag && !course.tags.includes(activeTag)) return false;
        if (!q) return true;
        return (
          course.title.toLowerCase().includes(q) ||
          course.tags.some((t) => t.toLowerCase().includes(q)) ||
          course.sections.some(
            (s) =>
              s.title.toLowerCase().includes(q) ||
              s.lessons.some((l) => l.title.toLowerCase().includes(q)),
          )
        );
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.lastOpenedAt || b.createdAt).localeCompare(a.lastOpenedAt || a.createdAt);
      });
  }, [courses, search, statusFilter, activeTag]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const droppedPath = window.playmachine?.getPathForFile(file);
    if (droppedPath) {
      onDropFolderPath(droppedPath);
    }
  };

  return (
    <div
      className="relative h-full overflow-y-auto bg-canvas"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => openMenuId && setOpenMenuId(null)}
    >
      {/* Drag-and-drop full overlay */}
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-mint/90 p-10 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-4 border-2 border-dashed border-ink bg-paper px-14 py-12 text-ink shadow-offset-teal">
            <Upload className="size-10 text-iris-ink" strokeWidth={1.6} />
            <div className="text-center">
              <h3 className="text-xl font-semibold tracking-tight">Drop Course Folder Here</h3>
              <p className="mt-1 text-xs text-ink-muted">
                We’ll scan videos, organize modules, and generate clean lesson titles automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {courses.length === 0 ? (
        /* EMPTY STATE — Signature Faddy Mint Architectural Hero */
        <div className="min-h-full flex flex-col">
          <section
            data-tone="mint"
            className="relative border-b border-line bg-mint bg-squares"
          >
            <div className="mx-auto flex max-w-5xl">
              <div className="hidden w-12 shrink-0 border-r border-line bg-hatch-mint lg:block" />
              <div className="relative flex-1 px-8 py-14 sm:px-12">
                <CrosshairTick className="-top-1.5 -left-1.5 text-ink/50" />
                <CrosshairTick className="-top-1.5 -right-1.5 text-ink/50" />
                <CrosshairTick className="-bottom-1.5 -left-1.5 text-ink/50" />
                <CrosshairTick className="-bottom-1.5 -right-1.5 text-ink/50" />

                <div className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-center">
                  <div className="max-w-xl">
                    <div className="mb-4 inline-flex items-center gap-2 border border-ink/25 bg-paper px-2.5 py-1 font-mono text-[11px] font-medium text-ink">
                      <Sparkles className="size-3 text-iris-ink" strokeWidth={1.8} />
                      <span>Local macOS Course LMS · 100% Offline</span>
                    </div>

                    <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-ink sm:text-[2.75rem]">
                      Local video folders,
                      <span className="block text-iris-ink">modern course studio.</span>
                    </h1>

                    <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink/80">
                      Pick any folder or collection of video tutorials. Playmachine automatically
                      builds modules, generates crisp lesson titles from raw filenames, and gives
                      you notes, bookmarks, flashcards, and streaks.
                    </p>

                    <div className="mt-7 flex flex-wrap items-center gap-3">
                      <Button variant="ink" size="md" onClick={onPickFolder}>
                        <FolderPlus className="size-4" strokeWidth={1.7} />
                        <span>Pick Course Folder</span>
                        <ArrowRight className="size-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                      </Button>
                      <span className="font-mono text-xs text-ink/65">
                        or drag &amp; drop a folder anywhere
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <BrandMascotCard />
                  </div>
                </div>
              </div>
              <div className="hidden w-12 shrink-0 border-l border-line bg-hatch-mint lg:block" />
            </div>
          </section>

          {/* How Title Generation + LMS Works */}
          <section className="mx-auto w-full max-w-5xl flex-1 px-8 py-10">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] tracking-wider text-fg-muted uppercase">
                  Smart Title Engine
                </div>
                <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-fg">
                  Messy filenames become clean LMS lessons automatically
                </h2>
              </div>
            </div>

            <CrosshairFrame className="bg-panel">
              <div className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
                <div className="p-5">
                  <div className="mb-2 inline-flex border border-ink/20 bg-mint-soft px-2 py-0.5 font-mono text-[10px] font-medium text-ink">
                    01 · AUTO-TITLING
                  </div>
                  <h3 className="text-sm font-semibold text-fg">
                    Smart Lesson Title Generator
                  </h3>
                  <div className="mt-3 space-y-1.5 border border-line bg-panel-head p-2.5 font-mono text-[10px]">
                    <div className="truncate text-fg-muted line-through">
                      04_useEffect_and_REST_api_1080p.mp4
                    </div>
                    <div className="flex items-center gap-1.5 font-sans text-xs font-semibold text-fg">
                      <span className="font-mono text-[10px] text-highlight">04</span>
                      useEffect and REST API
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-2 inline-flex border border-ink/20 bg-teal/20 px-2 py-0.5 font-mono text-[10px] font-medium text-fg">
                    02 · LMS WORKSPACE
                  </div>
                  <h3 className="text-sm font-semibold text-fg">
                    Timestamped Notes &amp; Recall
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                    Press <kbd className="border border-line px-1 font-mono text-[10px]">N</kbd> to
                    capture a timestamped Markdown note,{' '}
                    <kbd className="border border-line px-1 font-mono text-[10px]">B</kbd> for
                    bookmarks, build flashcards, and export everything to <code className="font-mono">.md</code>.
                  </p>
                </div>

                <div className="p-5">
                  <div className="mb-2 inline-flex border border-ink/20 bg-peach/30 px-2 py-0.5 font-mono text-[10px] font-medium text-fg">
                    03 · COLLECTIONS
                  </div>
                  <h3 className="text-sm font-semibold text-fg">
                    Single Course or Whole Library
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                    Import a single course with module subfolders, or pick a root collection folder
                    to enroll every course subfolder at once — with native{' '}
                    <code className="font-mono">.srt</code>/<code className="font-mono">.vtt</code>{' '}
                    subtitles.
                  </p>
                </div>
              </div>
            </CrosshairFrame>
          </section>
        </div>
      ) : (
        /* POPULATED COURSE LIBRARY DASHBOARD */
        <div className="mx-auto max-w-6xl space-y-7 px-6 py-6 sm:px-8">
          {/* Continue Learning Faddy Mint Hero Banner */}
          {resumeCourse && (() => {
            const stats = getCourseStats(resumeCourse);
            const activeTarget = findLessonInCourse(resumeCourse, resumeCourse.lastLessonId);
            return (
              <section
                data-tone="mint"
                className="relative border border-ink bg-mint bg-squares shadow-offset-teal"
              >
                <div className="flex flex-col justify-between gap-6 p-6 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="border border-ink bg-ink px-2 py-0.5 font-mono text-[10px] font-medium text-ivory uppercase">
                        Continue Learning
                      </span>
                      <span className="font-mono text-[11px] text-ink/75">
                        {stats.completedLessons}/{stats.totalLessons} lessons ·{' '}
                        {stats.progressPercent}% complete
                      </span>
                    </div>
                    <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">
                      {resumeCourse.title}
                    </h1>
                    {activeTarget && (
                      <p className="mt-1 flex items-center gap-2 text-xs text-ink/80">
                        <span className="border border-ink/25 bg-paper px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink">
                          {activeTarget.lesson.displayIndex}
                        </span>
                        <span className="truncate font-medium">
                          {activeTarget.lesson.title}
                        </span>
                        {activeTarget.lesson.watchedSeconds > 5 && (
                          <span className="shrink-0 font-mono text-[11px] text-iris-ink">
                            @ {formatDuration(activeTarget.lesson.watchedSeconds)}
                          </span>
                        )}
                      </p>
                    )}

                    {/* Progress bar */}
                    <div className="mt-4 max-w-md">
                      <div className="h-2.5 w-full border border-ink bg-paper bg-hatch-mint">
                        <div
                          className="h-full bg-ink transition-all duration-300"
                          style={{ width: `${stats.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <Button
                      variant="ink"
                      size="md"
                      onClick={() =>
                        onOpenCourse(resumeCourse.id, activeTarget?.lesson.id)
                      }
                    >
                      <Play className="size-3.5 fill-current" />
                      <span>Resume Lesson</span>
                      <ArrowRight className="size-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                    </Button>
                  </div>
                </div>
              </section>
            );
          })()}

          {/* Architectural KPI Strip */}
          <CrosshairFrame className="bg-panel">
            <div className="grid grid-cols-2 divide-x divide-y divide-line md:grid-cols-4 md:divide-y-0">
              <div className="p-4">
                <div className="flex items-center justify-between text-fg-muted">
                  <span className="font-mono text-[10px] tracking-wider uppercase">Courses</span>
                  <BookOpen className="size-3.5 text-highlight" strokeWidth={1.6} />
                </div>
                <div className="mt-1.5 text-2xl font-semibold tabular-nums text-fg">
                  {courses.length}
                </div>
                <div className="mt-0.5 text-[11px] text-fg-muted">
                  {aggregate.totalLessons} total lessons
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between text-fg-muted">
                  <span className="font-mono text-[10px] tracking-wider uppercase">Completed</span>
                  <CheckCircle2 className="size-3.5 text-teal" strokeWidth={1.6} />
                </div>
                <div className="mt-1.5 text-2xl font-semibold tabular-nums text-fg">
                  {aggregate.completedLessons}
                  <span className="ml-1 text-sm font-normal text-fg-muted">
                    / {aggregate.totalLessons}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-fg-muted">
                  {aggregate.totalLessons > 0
                    ? `${Math.round((aggregate.completedLessons / aggregate.totalLessons) * 100)}% overall mastery`
                    : '0% complete'}
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between text-fg-muted">
                  <span className="font-mono text-[10px] tracking-wider uppercase">Studied</span>
                  <Clock className="size-3.5 text-highlight" strokeWidth={1.6} />
                </div>
                <div className="mt-1.5 text-2xl font-semibold tabular-nums text-fg">
                  {formatHumanDuration(studySummary.totalSeconds)}
                </div>
                <div className="mt-0.5 text-[11px] text-fg-muted">
                  {formatHumanDuration(studySummary.todaySeconds)} today · {aggregate.totalNotes} notes
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between text-fg-muted">
                  <span className="font-mono text-[10px] tracking-wider uppercase">Streak</span>
                  <Flame className="size-3.5 text-peach" strokeWidth={1.8} />
                </div>
                <div className="mt-1.5 text-2xl font-semibold tabular-nums text-fg">
                  {studySummary.currentStreak}
                  <span className="ml-1 text-sm font-normal text-fg-muted">
                    {studySummary.currentStreak === 1 ? 'day' : 'days'}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-fg-muted">
                  Best: {studySummary.longestStreak}d · {studySummary.activeDays} active days
                </div>
              </div>
            </div>
          </CrosshairFrame>

          {/* Filter & Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['all', 'All Courses'],
                  ['in-progress', 'In Progress'],
                  ['not-started', 'Not Started'],
                  ['completed', 'Completed'],
                ] as Array<[StatusFilter, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    statusFilter === key
                      ? 'chip-active'
                      : 'border-line bg-panel text-fg-muted hover:border-line-strong hover:text-fg'
                  }`}
                >
                  {label}
                </button>
              ))}

              {allTags.length > 0 && (
                <>
                  <span className="mx-1 h-4 w-px bg-line" />
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                      className={`border px-2.5 py-1 font-mono text-[11px] transition cursor-pointer ${
                        activeTag === tag
                          ? 'border-ink bg-mint text-ink'
                          : 'border-line bg-panel-head text-fg-muted hover:text-fg'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-muted"
                  strokeWidth={1.6}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter courses or lessons…"
                  className="h-8 w-56 border border-line bg-panel pr-3 pl-8 text-xs text-fg placeholder:text-fg-muted outline-none focus:border-ink"
                />
              </div>
              <Button variant="ivory" size="sm" onClick={onPickFolder}>
                <FolderPlus className="size-3.5" strokeWidth={1.6} />
                <span>Add Folder</span>
              </Button>
            </div>
          </div>

          {/* Course Cards Grid */}
          {filteredCourses.length === 0 ? (
            <div className="border border-dashed border-line-strong bg-panel p-12 text-center">
              <p className="text-sm font-medium text-fg">No courses match your current filter.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setActiveTag(null);
                }}
                className="mt-2 text-xs font-medium text-highlight underline underline-offset-2 cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredCourses.map((course) => {
                const stats = getCourseStats(course);
                const accent = getAccentClasses(course.accent);
                const coverUrl =
                  course.coverPath && window.playmachine
                    ? window.playmachine.getMediaUrl(course.coverPath)
                    : null;

                return (
                  <article
                    key={course.id}
                    className={`group relative flex flex-col border border-line-strong bg-panel transition-all duration-150 hover:border-ink hover:${accent.shadow}`}
                  >
                    {/* Top Cover / Faddy Architectural Banner */}
                    <div
                      onClick={() => onOpenCourse(course.id)}
                      className={`relative h-28 cursor-pointer overflow-hidden border-b border-line ${
                        coverUrl ? 'bg-ink' : `${accent.bg} bg-squares`
                      }`}
                    >
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={course.title}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full flex-col justify-between p-4 text-ink">
                          <div className="flex items-center justify-between">
                            <span className="border border-ink/25 bg-paper/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-ink">
                              {course.sections.length}{' '}
                              {course.sections.length === 1 ? 'MODULE' : 'MODULES'}
                            </span>
                            {stats.totalDuration > 0 && (
                              <span className="border border-ink/25 bg-paper/90 px-2 py-0.5 font-mono text-[10px] text-ink">
                                {formatHumanDuration(stats.totalDuration)}
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[10px] tracking-tight text-ink/70 truncate">
                            {course.folderPath.split('/').slice(-2).join(' / ')}
                          </div>
                        </div>
                      )}

                      {/* Status badge overlay */}
                      {stats.status === 'completed' && (
                        <span className="absolute right-3 bottom-2.5 inline-flex items-center gap-1 border border-ink bg-mint px-2 py-0.5 font-mono text-[10px] font-semibold text-ink">
                          <CheckCircle2 className="size-3" strokeWidth={2} />
                          COMPLETED
                        </span>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenCourse(course.id)}
                          className="text-left text-base leading-snug font-semibold tracking-tight text-fg hover:text-highlight cursor-pointer line-clamp-2"
                        >
                          {course.title}
                        </button>

                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === course.id ? null : course.id);
                            }}
                            className="inline-flex size-7 items-center justify-center border border-transparent text-fg-muted hover:border-line hover:bg-panel-head hover:text-fg cursor-pointer"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>

                          {openMenuId === course.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute top-8 right-0 z-20 w-44 border border-ink bg-panel py-1 text-xs shadow-offset-ink"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  onTogglePin(course.id);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-fg hover:bg-mint hover:text-ink cursor-pointer"
                              >
                                <Pin className="size-3.5" />
                                {course.pinned ? 'Unpin course' : 'Pin to sidebar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onRescanCourse(course.id);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-fg hover:bg-mint hover:text-ink cursor-pointer"
                              >
                                <RefreshCw className="size-3.5" />
                                Rescan folder
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void window.playmachine?.revealInFinder(course.folderPath);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-fg hover:bg-mint hover:text-ink cursor-pointer"
                              >
                                <FolderOpen className="size-3.5" />
                                Reveal in Finder
                              </button>
                              <div className="my-1 border-t border-line" />
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteCourse(course.id);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-fg hover:bg-peach hover:text-ink cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                                Remove from library
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Tags */}
                      {course.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {course.tags.map((tag) => (
                            <span
                              key={tag}
                              className="border border-line bg-panel-head px-1.5 py-0.5 font-mono text-[10px] text-fg-muted"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Progress bar + metadata */}
                      <div className="mt-auto pt-4">
                        <div className="mb-1.5 flex items-center justify-between font-mono text-[11px]">
                          <span className="text-fg-muted">
                            {stats.completedLessons}/{stats.totalLessons} lessons
                          </span>
                          <span className="font-semibold text-fg">
                            {stats.progressPercent}%
                          </span>
                        </div>
                        <div className="h-2 w-full border border-line-strong bg-panel-head bg-hatch">
                          <div
                            className={`h-full transition-all duration-300 ${accent.bar}`}
                            style={{ width: `${stats.progressPercent}%` }}
                          />
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[11px] text-fg-muted">
                          <div className="flex items-center gap-3 font-mono">
                            <span className="inline-flex items-center gap-1" title="Notes">
                              <StickyNote className="size-3" />
                              {stats.totalNotes}
                            </span>
                            <span className="inline-flex items-center gap-1" title="Bookmarks">
                              <Bookmark className="size-3" />
                              {stats.totalBookmarks}
                            </span>
                            <span className="hidden sm:inline">
                              {formatRelativeTime(course.lastOpenedAt || course.createdAt)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => onOpenCourse(course.id)}
                            className="inline-flex items-center gap-1 font-semibold text-highlight hover:underline cursor-pointer"
                          >
                            <span>{stats.status === 'not-started' ? 'Start' : 'Open'}</span>
                            <ArrowRight className="size-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}

              {/* Quick Drop / Add Tile */}
              <button
                type="button"
                onClick={onPickFolder}
                className="flex min-h-[240px] flex-col items-center justify-center gap-3 border border-dashed border-line-strong bg-hatch p-6 text-center transition hover:border-ink hover:bg-panel cursor-pointer"
              >
                <span className="flex size-10 items-center justify-center border border-ink bg-mint text-ink shadow-[2px_2px_0_0_var(--color-teal)]">
                  <FolderPlus className="size-5" strokeWidth={1.6} />
                </span>
                <div>
                  <div className="text-sm font-semibold text-fg">Import Another Folder</div>
                  <p className="mt-1 max-w-[200px] text-xs text-fg-muted">
                    Pick a single course or a collection folder — or drag &amp; drop here.
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
