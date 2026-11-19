import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Brain,
  Download,
  Play,
  Search,
  StickyNote,
} from 'lucide-react';
import type { Course } from '@shared/types';
import { buildCourseNotesMarkdown } from '@/lib/courseHelpers';
import { formatDuration } from '@/lib/format';
import { Button } from './ui/Button';
import { CrosshairFrame } from './ui/CrosshairFrame';

interface NotesHubViewProps {
  courses: Course[];
  onJumpToLesson: (courseId: string, lessonId: string, timestamp?: number) => void;
  onToast: (msg: string, tone?: 'mint' | 'peach' | 'ink') => void;
}

type HubFilter = 'all' | 'notes' | 'bookmarks' | 'flashcards';

interface HubEntry {
  id: string;
  kind: 'note' | 'bookmark' | 'flashcard';
  courseId: string;
  courseTitle: string;
  sectionTitle: string;
  lessonId: string;
  lessonTitle: string;
  lessonIndex: string;
  timestamp?: number;
  tag?: string;
  primaryText: string;
  secondaryText?: string;
  createdAt: string;
}

export const NotesHubView: React.FC<NotesHubViewProps> = ({
  courses,
  onJumpToLesson,
  onToast,
}) => {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<HubFilter>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');

  const entries = useMemo<HubEntry[]>(() => {
    const out: HubEntry[] = [];
    for (const course of courses) {
      if (selectedCourseId !== 'all' && course.id !== selectedCourseId) continue;
      for (const section of course.sections) {
        for (const lesson of section.lessons) {
          for (const note of lesson.notes) {
            out.push({
              id: note.id,
              kind: 'note',
              courseId: course.id,
              courseTitle: course.title,
              sectionTitle: section.title,
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              lessonIndex: lesson.displayIndex,
              timestamp: note.timestamp,
              tag: note.tag,
              primaryText: note.content,
              createdAt: note.createdAt,
            });
          }
          for (const bm of lesson.bookmarks) {
            out.push({
              id: bm.id,
              kind: 'bookmark',
              courseId: course.id,
              courseTitle: course.title,
              sectionTitle: section.title,
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              lessonIndex: lesson.displayIndex,
              timestamp: bm.timestamp,
              primaryText: bm.label,
              createdAt: bm.createdAt,
            });
          }
          for (const fc of lesson.flashcards) {
            out.push({
              id: fc.id,
              kind: 'flashcard',
              courseId: course.id,
              courseTitle: course.title,
              sectionTitle: section.title,
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              lessonIndex: lesson.displayIndex,
              primaryText: fc.question,
              secondaryText: fc.answer,
              tag: fc.mastered ? 'mastered' : 'review',
              createdAt: fc.createdAt,
            });
          }
        }
      }
    }

    const q = search.trim().toLowerCase();
    return out
      .filter((item) => {
        if (kindFilter === 'notes' && item.kind !== 'note') return false;
        if (kindFilter === 'bookmarks' && item.kind !== 'bookmark') return false;
        if (kindFilter === 'flashcards' && item.kind !== 'flashcard') return false;
        if (!q) return true;
        return (
          item.primaryText.toLowerCase().includes(q) ||
          (item.secondaryText?.toLowerCase().includes(q) ?? false) ||
          item.lessonTitle.toLowerCase().includes(q) ||
          item.courseTitle.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [courses, kindFilter, search, selectedCourseId]);

  const handleExportAll = async () => {
    const targetCourses =
      selectedCourseId === 'all'
        ? courses
        : courses.filter((c) => c.id === selectedCourseId);
    const md = targetCourses.map(buildCourseNotesMarkdown).join('\n\n---\n\n');
    const res = await window.playmachine?.exportMarkdown({
      defaultFileName: 'playmachine-study-notes.md',
      markdown: md,
    });
    if (res?.savedPath) {
      onToast(`Exported notes to ${res.savedPath.split('/').pop()}`, 'mint');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6 sm:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div>
            <div className="font-mono text-[10px] tracking-wider text-fg-muted uppercase">
              Knowledge Base
            </div>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-fg">
              Notes, Bookmarks &amp; Review Cards
            </h1>
            <p className="mt-1 text-xs text-fg-muted">
              Every timestamped note and flashcard across your local courses, clickable to jump
              right back to the video moment.
            </p>
          </div>
          <Button
            variant="ink"
            size="sm"
            disabled={entries.length === 0}
            onClick={handleExportAll}
          >
            <Download className="size-3.5" />
            Export Markdown
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['all', 'Everything'],
                ['notes', 'Notes'],
                ['bookmarks', 'Bookmarks'],
                ['flashcards', 'Review Cards'],
              ] as Array<[HubFilter, string]>
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(k)}
                className={`border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  kindFilter === k
                    ? 'chip-active'
                    : 'border-line bg-panel text-fg-muted hover:text-fg'
                }`}
              >
                {label}
              </button>
            ))}

            {courses.length > 1 && (
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="h-8 border border-line bg-panel px-2.5 text-xs text-fg outline-none focus:border-ink"
              >
                <option value="all">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-muted"
              strokeWidth={1.6}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes & cards…"
              className="h-8 w-60 border border-line bg-panel pr-3 pl-8 text-xs text-fg placeholder:text-fg-muted outline-none focus:border-ink"
            />
          </div>
        </div>

        {/* Results */}
        {entries.length === 0 ? (
          <CrosshairFrame className="bg-panel p-12 text-center">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center border border-ink bg-mint-soft text-ink">
              <StickyNote className="size-5" strokeWidth={1.6} />
            </div>
            <h3 className="text-sm font-semibold text-fg">No study notes captured yet</h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-fg-muted">
              Open any lesson and press <kbd className="border border-line px-1 font-mono">N</kbd>{' '}
              to take a timestamped note or{' '}
              <kbd className="border border-line px-1 font-mono">B</kbd> to bookmark a moment.
            </p>
          </CrosshairFrame>
        ) : (
          <div className="space-y-2.5">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col justify-between gap-3 border border-line bg-panel p-4 transition hover:border-ink sm:flex-row sm:items-start"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px]">
                    <span
                      className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-semibold uppercase ${
                        entry.kind === 'note'
                          ? 'border-ink/25 bg-mint text-ink'
                          : entry.kind === 'bookmark'
                            ? 'border-ink/25 bg-peach text-ink'
                            : 'border-teal/50 bg-teal/20 text-fg'
                      }`}
                    >
                      {entry.kind === 'note' ? (
                        <StickyNote className="size-2.5" />
                      ) : entry.kind === 'bookmark' ? (
                        <Bookmark className="size-2.5" />
                      ) : (
                        <Brain className="size-2.5" />
                      )}
                      {entry.kind}
                    </span>

                    {entry.timestamp !== undefined && (
                      <span className="border border-line bg-panel-head px-1.5 py-0.5 font-semibold text-fg">
                        {formatDuration(entry.timestamp)}
                      </span>
                    )}

                    <span className="truncate text-fg-muted">
                      {entry.courseTitle} › {entry.lessonIndex}. {entry.lessonTitle}
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-relaxed font-medium text-fg">
                    {entry.primaryText}
                  </p>
                  {entry.secondaryText && (
                    <p className="mt-1.5 border-l-2 border-teal pl-2.5 text-xs text-fg-muted">
                      {entry.secondaryText}
                    </p>
                  )}
                </div>

                <Button
                  variant="ivory"
                  size="xs"
                  onClick={() =>
                    onJumpToLesson(entry.courseId, entry.lessonId, entry.timestamp)
                  }
                >
                  <Play className="size-3 fill-current" />
                  Jump
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
