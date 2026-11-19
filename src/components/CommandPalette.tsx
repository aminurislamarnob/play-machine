import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  FolderPlus,
  Moon,
  Play,
  Search,
  StickyNote,
  Sun,
  X,
} from 'lucide-react';
import type { AppTheme, Course } from '@shared/types';
import { formatDuration } from '@/lib/format';

interface CommandPaletteProps {
  open: boolean;
  courses: Course[];
  theme: AppTheme;
  onClose: () => void;
  onSelectLesson: (courseId: string, lessonId: string, seekTime?: number) => void;
  onImportFolder: () => void;
  onToggleTheme: () => void;
}

interface PaletteItem {
  id: string;
  kind: 'action' | 'course' | 'lesson' | 'note';
  title: string;
  subtitle: string;
  badge?: string;
  run: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  courses,
  theme,
  onClose,
  onSelectLesson,
  onImportFolder,
  onToggleTheme,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const list: PaletteItem[] = [
      {
        id: 'act-import',
        kind: 'action',
        title: 'Import Course or Collection Folder…',
        subtitle: 'Scan a local directory of videos and auto-generate lesson titles',
        badge: '⌘O',
        run: () => {
          onClose();
          onImportFolder();
        },
      },
      {
        id: 'act-theme',
        kind: 'action',
        title: theme === 'canvas' ? 'Switch to Ink Dark Theme' : 'Switch to Ivory Light Theme',
        subtitle: 'Toggle Faddy Canvas / Ink color tone',
        badge: '⌘⇧D',
        run: () => {
          onToggleTheme();
          onClose();
        },
      },
    ];

    for (const course of courses) {
      list.push({
        id: `crs-${course.id}`,
        kind: 'course',
        title: course.title,
        subtitle: `${course.sections.length} modules · ${course.folderPath}`,
        badge: 'COURSE',
        run: () => {
          onSelectLesson(course.id, course.lastLessonId || course.sections[0]?.lessons[0]?.id || '');
          onClose();
        },
      });

      for (const section of course.sections) {
        for (const lesson of section.lessons) {
          list.push({
            id: `les-${lesson.id}`,
            kind: 'lesson',
            title: `${lesson.displayIndex}. ${lesson.title}`,
            subtitle: `${course.title} › ${section.title}`,
            badge: lesson.duration > 0 ? formatDuration(lesson.duration) : 'VIDEO',
            run: () => {
              onSelectLesson(course.id, lesson.id);
              onClose();
            },
          });

          for (const note of lesson.notes) {
            list.push({
              id: `note-${note.id}`,
              kind: 'note',
              title: note.content,
              subtitle: `Note in ${course.title} › ${lesson.title}`,
              badge: formatDuration(note.timestamp),
              run: () => {
                onSelectLesson(course.id, lesson.id, note.timestamp);
                onClose();
              },
            });
          }
        }
      }
    }

    if (!q) return list.slice(0, 14);
    return list
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [courses, query, theme, onClose, onImportFolder, onSelectLesson, onToggleTheme]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(items.length - 1, prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(0, prev - 1));
    } else if (e.key === 'Enter' && items[selectedIdx]) {
      e.preventDefault();
      items[selectedIdx].run();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/50 pt-[12vh] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl border border-ink bg-panel shadow-[5px_5px_0_0_var(--color-mint)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2.5 border-b border-line bg-panel-head px-4 py-3">
          <Search className="size-4 text-fg-muted" strokeWidth={1.7} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses, generated lesson titles, or notes…"
            className="flex-1 bg-transparent text-sm text-fg placeholder:text-fg-muted outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-fg-muted hover:text-fg cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto divide-y divide-line/60">
          {items.length === 0 ? (
            <div className="p-8 text-center text-xs text-fg-muted">
              No matching lessons, courses, or notes for “{query}”.
            </div>
          ) : (
            items.map((item, idx) => {
              const active = idx === selectedIdx;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onClick={item.run}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition cursor-pointer ${
                    active ? 'bg-mint text-ink' : 'bg-panel text-fg hover:bg-panel-head'
                  }`}
                >
                  <span className="shrink-0 opacity-75">
                    {item.kind === 'course' ? (
                      <BookOpen className="size-4" strokeWidth={1.6} />
                    ) : item.kind === 'lesson' ? (
                      <Play className="size-3.5" strokeWidth={1.7} />
                    ) : item.kind === 'note' ? (
                      <StickyNote className="size-3.5" strokeWidth={1.6} />
                    ) : item.id === 'act-import' ? (
                      <FolderPlus className="size-4" strokeWidth={1.6} />
                    ) : theme === 'canvas' ? (
                      <Moon className="size-4" strokeWidth={1.6} />
                    ) : (
                      <Sun className="size-4" strokeWidth={1.6} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{item.title}</div>
                    <div
                      className={`truncate text-[11px] ${
                        active ? 'text-ink/75' : 'text-fg-muted'
                      }`}
                    >
                      {item.subtitle}
                    </div>
                  </div>
                  {item.badge && (
                    <span
                      className={`shrink-0 border px-1.5 py-0.5 font-mono text-[10px] ${
                        active
                          ? 'border-ink/30 bg-ink text-ivory'
                          : 'border-line bg-panel-head text-fg-muted'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-panel-head px-4 py-2 font-mono text-[10px] text-fg-muted">
          <span>↑↓ Navigate · ↵ Open</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  );
};
