import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  StickyNote,
  Subtitles,
} from 'lucide-react';
import type { Course, Lesson } from '@shared/types';
import { getCourseStats } from '@/lib/courseHelpers';
import { formatDuration, formatHumanDuration } from '@/lib/format';

interface CurriculumSidebarProps {
  course: Course;
  activeLessonId: string;
  showOriginalFileNames: boolean;
  onSelectLesson: (lessonId: string) => void;
  onToggleComplete: (lessonId: string) => void;
  onRenameLesson: (lessonId: string, newTitle: string) => void;
  onRenameSection: (sectionId: string, newTitle: string) => void;
  onRescanCourse: () => void;
  onExportNotes: () => void;
}

type LessonFilter = 'all' | 'unwatched' | 'bookmarked' | 'notes';

export const CurriculumSidebar: React.FC<CurriculumSidebarProps> = ({
  course,
  activeLessonId,
  showOriginalFileNames,
  onSelectLesson,
  onToggleComplete,
  onRenameLesson,
  onRenameSection,
  onRescanCourse,
  onExportNotes,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LessonFilter>('all');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  const stats = useMemo(() => getCourseStats(course), [course]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const matchesFilter = (lesson: Lesson): boolean => {
    if (filter === 'unwatched' && lesson.completed) return false;
    if (filter === 'bookmarked' && lesson.bookmarks.length === 0) return false;
    if (filter === 'notes' && lesson.notes.length === 0) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      lesson.title.toLowerCase().includes(q) ||
      lesson.originalFileName.toLowerCase().includes(q)
    );
  };

  const commitLessonRename = (lesson: Lesson) => {
    onRenameLesson(lesson.id, draftTitle);
    setEditingLessonId(null);
  };

  const commitSectionRename = (sectionId: string) => {
    onRenameSection(sectionId, draftTitle);
    setEditingSectionId(null);
  };

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-line bg-panel xl:w-[348px]">
      {/* Syllabus Header + Course Progress */}
      <div className="border-b border-line bg-panel-head p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-[10px] tracking-wider text-fg-muted uppercase">
              Course Curriculum
            </div>
            <h2 className="mt-0.5 truncate text-sm font-semibold tracking-tight text-fg">
              {course.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onRescanCourse}
              title="Rescan local folder for new videos"
              className="inline-flex size-7 items-center justify-center border border-line bg-panel text-fg-muted hover:border-line-strong hover:text-fg cursor-pointer"
            >
              <RefreshCw className="size-3.5" strokeWidth={1.6} />
            </button>
            <button
              type="button"
              onClick={onExportNotes}
              title="Export all course notes as Markdown"
              className="inline-flex size-7 items-center justify-center border border-line bg-panel text-fg-muted hover:border-line-strong hover:text-fg cursor-pointer"
            >
              <Download className="size-3.5" strokeWidth={1.6} />
            </button>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px]">
            <span className="text-fg-muted">
              {stats.completedLessons}/{stats.totalLessons} completed
              {stats.totalDuration > 0 && ` · ${formatHumanDuration(stats.totalDuration)}`}
            </span>
            <span className="font-semibold text-highlight">{stats.progressPercent}%</span>
          </div>
          <div className="h-2 w-full border border-line-strong bg-panel bg-hatch">
            <div
              className="h-full bg-teal transition-all duration-300"
              style={{ width: `${stats.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Search & Filter */}
        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-muted"
              strokeWidth={1.6}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lessons…"
              className="h-7 w-full border border-line bg-panel pr-2.5 pl-8 text-xs text-fg placeholder:text-fg-muted outline-none focus:border-ink"
            />
          </div>

          <div className="grid grid-cols-4 gap-1">
            {(
              [
                ['all', 'All'],
                ['unwatched', 'Todo'],
                ['notes', 'Notes'],
                ['bookmarked', 'Pins'],
              ] as Array<[LessonFilter, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`border py-1 font-mono text-[10px] font-medium transition cursor-pointer ${
                  filter === key
                    ? 'chip-active'
                    : 'border-line bg-panel text-fg-muted hover:text-fg'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sections & Lessons List */}
      <div className="flex-1 overflow-y-auto divide-y divide-line">
        {course.sections.map((section, secIdx) => {
          const visibleLessons = section.lessons.filter(matchesFilter);
          if (visibleLessons.length === 0 && (search || filter !== 'all')) return null;

          const secCompleted = section.lessons.filter((l) => l.completed).length;
          const secDuration = section.lessons.reduce((sum, l) => sum + (l.duration || 0), 0);
          const isCollapsed = Boolean(collapsedSections[section.id]);

          return (
            <div key={section.id}>
              {/* Section Accordion Header */}
              <div className="group/sec flex items-center justify-between gap-2 bg-panel-head/70 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-3.5 shrink-0 text-fg-muted" />
                  ) : (
                    <ChevronDown className="size-3.5 shrink-0 text-fg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    {editingSectionId === section.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={draftTitle}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onBlur={() => commitSectionRename(section.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitSectionRename(section.id);
                          if (e.key === 'Escape') setEditingSectionId(null);
                        }}
                        className="w-full border border-ink bg-panel px-1.5 py-0.5 text-xs font-semibold text-fg outline-none"
                      />
                    ) : (
                      <div className="truncate text-xs font-semibold text-fg">
                        <span className="mr-1.5 font-mono text-[10px] text-fg-muted">
                          M{String(secIdx + 1).padStart(2, '0')}
                        </span>
                        {section.title}
                      </div>
                    )}
                    <div className="mt-0.5 font-mono text-[10px] text-fg-muted">
                      {secCompleted}/{section.lessons.length} done
                      {secDuration > 0 && ` · ${formatHumanDuration(secDuration)}`}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  title="Rename module"
                  onClick={() => {
                    setEditingSectionId(section.id);
                    setDraftTitle(section.title);
                  }}
                  className="inline-flex size-6 items-center justify-center text-fg-muted opacity-0 transition group-hover/sec:opacity-100 hover:text-fg cursor-pointer"
                >
                  <Pencil className="size-3" />
                </button>
              </div>

              {/* Lessons in Section */}
              {!isCollapsed && (
                <div className="divide-y divide-line/50">
                  {visibleLessons.map((lesson) => {
                    const isActive = lesson.id === activeLessonId;
                    const partialPct =
                      !lesson.completed && lesson.duration > 0 && lesson.watchedSeconds > 3
                        ? Math.min(99, Math.round((lesson.watchedSeconds / lesson.duration) * 100))
                        : 0;
                    const isCustomTitled = lesson.title !== lesson.generatedTitle;

                    return (
                      <div
                        key={lesson.id}
                        className={`group/les relative flex items-start gap-2.5 px-3 py-2.5 transition ${
                          isActive
                            ? 'bg-[var(--active-row)]'
                            : 'bg-panel hover:bg-panel-head/50'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-teal" />
                        )}

                        {/* Completion Checkbox */}
                        <button
                          type="button"
                          onClick={() => onToggleComplete(lesson.id)}
                          title={lesson.completed ? 'Mark as incomplete' : 'Mark as completed'}
                          className={`mt-0.5 flex size-4 shrink-0 items-center justify-center border transition cursor-pointer ${
                            lesson.completed
                              ? 'border-ink bg-mint text-ink'
                              : 'border-line-strong bg-panel hover:border-ink'
                          }`}
                        >
                          {lesson.completed && <Check className="size-3" strokeWidth={2.5} />}
                        </button>

                        {/* Lesson Title & Meta */}
                        <div
                          onClick={() => editingLessonId !== lesson.id && onSelectLesson(lesson.id)}
                          className="min-w-0 flex-1 cursor-pointer"
                        >
                          {editingLessonId === lesson.id ? (
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                autoFocus
                                type="text"
                                value={draftTitle}
                                onChange={(e) => setDraftTitle(e.target.value)}
                                onBlur={() => commitLessonRename(lesson)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitLessonRename(lesson);
                                  if (e.key === 'Escape') setEditingLessonId(null);
                                }}
                                className="w-full border border-ink bg-panel px-1.5 py-0.5 text-xs text-fg outline-none"
                              />
                              {isCustomTitled && (
                                <button
                                  type="button"
                                  title="Reset to auto-generated title"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    onRenameLesson(lesson.id, lesson.generatedTitle);
                                    setEditingLessonId(null);
                                  }}
                                  className="inline-flex size-6 shrink-0 items-center justify-center border border-line bg-panel-head text-fg-muted hover:text-fg cursor-pointer"
                                >
                                  <RotateCcw className="size-3" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0">
                                <div
                                  className={`text-xs leading-snug ${
                                    isActive
                                      ? 'font-semibold text-fg'
                                      : lesson.completed
                                        ? 'text-fg-muted'
                                        : 'font-medium text-fg'
                                  }`}
                                >
                                  <span className="mr-1.5 font-mono text-[10px] text-highlight">
                                    {lesson.displayIndex}
                                  </span>
                                  {lesson.title}
                                </div>
                                {showOriginalFileNames && (
                                  <div className="mt-0.5 truncate font-mono text-[10px] text-fg-muted/75">
                                    {lesson.originalFileName}
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                title="Rename lesson title"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingLessonId(lesson.id);
                                  setDraftTitle(lesson.title);
                                }}
                                className="inline-flex size-5 shrink-0 items-center justify-center text-fg-muted opacity-0 transition group-hover/les:opacity-100 hover:text-fg cursor-pointer"
                              >
                                <Pencil className="size-2.5" />
                              </button>
                            </div>
                          )}

                          {/* Mini Metadata Badges */}
                          <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-fg-muted">
                            {lesson.duration > 0 && (
                              <span>{formatDuration(lesson.duration)}</span>
                            )}
                            {lesson.subtitles.length > 0 && (
                              <span
                                className="inline-flex items-center gap-0.5 border border-line px-1"
                                title="Subtitles available"
                              >
                                <Subtitles className="size-2.5" />
                                CC
                              </span>
                            )}
                            {lesson.notes.length > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-highlight">
                                <StickyNote className="size-2.5" />
                                {lesson.notes.length}
                              </span>
                            )}
                            {lesson.bookmarks.length > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-peach">
                                <Bookmark className="size-2.5" />
                                {lesson.bookmarks.length}
                              </span>
                            )}
                          </div>

                          {/* In-progress partial bar */}
                          {partialPct > 0 && (
                            <div className="mt-1.5 h-1 w-full bg-line/70">
                              <div
                                className="h-full bg-teal"
                                style={{ width: `${partialPct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
