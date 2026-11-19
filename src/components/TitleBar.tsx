import React from 'react';
import {
  ChevronRight,
  FolderPlus,
  Moon,
  PanelLeft,
  Search,
  Sun,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { AppTheme, Course, Lesson } from '@shared/types';
import { BrandMark } from './BrandMark';
import { Button } from './ui/Button';
import { getCourseStats } from '@/lib/courseHelpers';

export type ActiveRoute = 'library' | 'player' | 'notes' | 'activity' | 'settings';

interface TitleBarProps {
  route: ActiveRoute;
  activeCourse?: Course;
  activeLesson?: Lesson;
  theme: AppTheme;
  sidebarOpen: boolean;
  focusMode: boolean;
  onToggleSidebar: () => void;
  onToggleFocus: () => void;
  onToggleTheme: () => void;
  onOpenImport: () => void;
  onOpenPalette: () => void;
  onNavigate: (route: ActiveRoute) => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  route,
  activeCourse,
  activeLesson,
  theme,
  sidebarOpen,
  focusMode,
  onToggleSidebar,
  onToggleFocus,
  onToggleTheme,
  onOpenImport,
  onOpenPalette,
  onNavigate,
}) => {
  const isMac = typeof window !== 'undefined' && window.playmachine?.platform === 'darwin';
  const courseStats = activeCourse ? getCourseStats(activeCourse) : null;

  const routeLabel: Record<ActiveRoute, string> = {
    library: 'Course Library',
    player: 'Classroom',
    notes: 'Notes & Bookmarks',
    activity: 'Study Activity',
    settings: 'Preferences',
  };

  return (
    <header
      className={`app-drag flex h-11 shrink-0 items-center justify-between border-b border-line bg-panel-head pr-3 text-xs select-none ${
        isMac ? 'pl-[78px]' : 'pl-3'
      }`}
    >
      {/* Left: Sidebar toggle + Faddy-style Breadcrumbs */}
      <div className="app-no-drag flex min-w-0 flex-1 items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarOpen ? 'Hide navigation rail' : 'Show navigation rail'}
          className="mr-1 inline-flex size-7 items-center justify-center border border-transparent text-fg-muted transition hover:border-line hover:bg-panel hover:text-fg cursor-pointer"
        >
          <PanelLeft className="size-3.5" strokeWidth={1.6} />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('library')}
          className="inline-flex shrink-0 items-center gap-1.5 font-semibold tracking-tight text-fg hover:text-highlight cursor-pointer"
        >
          <BrandMark size={19} />
          <span className="hidden sm:inline">Playmachine</span>
        </button>

        <ChevronRight className="size-3 shrink-0 text-fg-muted/60" strokeWidth={1.6} />

        {route === 'player' && activeCourse ? (
          <>
            <button
              type="button"
              onClick={() => onNavigate('library')}
              className="hidden shrink-0 text-fg-muted hover:text-fg md:inline cursor-pointer"
            >
              Library
            </button>
            <ChevronRight
              className="hidden size-3 shrink-0 text-fg-muted/60 md:block"
              strokeWidth={1.6}
            />
            <span className="max-w-[180px] truncate text-fg-muted">{activeCourse.title}</span>
            {activeLesson && (
              <>
                <ChevronRight className="size-3 shrink-0 text-fg-muted/60" strokeWidth={1.6} />
                <span className="max-w-[260px] truncate font-medium text-fg">
                  <span className="mr-1.5 font-mono text-[11px] text-highlight">
                    {activeLesson.displayIndex}
                  </span>
                  {activeLesson.title}
                </span>
              </>
            )}
            {courseStats && (
              <span
                className={`ml-1.5 hidden shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] leading-none lg:inline-flex ${
                  courseStats.status === 'completed'
                    ? 'border-ink/20 bg-mint text-ink'
                    : 'border-line-strong bg-panel text-fg-muted'
                }`}
              >
                {courseStats.progressPercent}%
              </span>
            )}
          </>
        ) : (
          <span className="truncate font-medium text-fg">{routeLabel[route]}</span>
        )}
      </div>

      {/* Right: Search Palette, Focus toggle, Theme switcher, Import CTA */}
      <div className="app-no-drag flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenPalette}
          className="inline-flex h-7 items-center gap-2 border border-line bg-panel px-2.5 text-[11px] text-fg-muted transition hover:border-line-strong hover:text-fg cursor-pointer"
          title="Quick jump (⌘K)"
        >
          <Search className="size-3" strokeWidth={1.6} />
          <span className="hidden md:inline">Jump to lesson…</span>
          <kbd className="border border-line bg-panel-head px-1 py-0.2 font-mono text-[10px] text-fg-muted">
            ⌘K
          </kbd>
        </button>

        {route === 'player' && (
          <button
            type="button"
            onClick={onToggleFocus}
            title={focusMode ? 'Exit focus mode (⌘\\)' : 'Focus / Theater mode (⌘\\)'}
            className={`inline-flex h-7 items-center gap-1.5 border px-2 text-[11px] font-medium transition cursor-pointer ${
              focusMode
                ? 'border-ink bg-mint text-ink'
                : 'border-line bg-panel text-fg-muted hover:border-line-strong hover:text-fg'
            }`}
          >
            {focusMode ? (
              <Minimize2 className="size-3" strokeWidth={1.6} />
            ) : (
              <Maximize2 className="size-3" strokeWidth={1.6} />
            )}
            <span className="hidden lg:inline">{focusMode ? 'Exit Focus' : 'Focus'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleTheme}
          title={theme === 'canvas' ? 'Switch to Ink dark theme' : 'Switch to Ivory light theme'}
          className="inline-flex size-7 items-center justify-center border border-line bg-panel text-fg-muted transition hover:border-line-strong hover:text-fg cursor-pointer"
        >
          {theme === 'canvas' ? (
            <Moon className="size-3.5" strokeWidth={1.6} />
          ) : (
            <Sun className="size-3.5 text-mint" strokeWidth={1.6} />
          )}
        </button>

        <Button variant="ink" size="xs" onClick={onOpenImport}>
          <FolderPlus className="size-3.5" strokeWidth={1.6} />
          <span>Import Folder</span>
        </Button>
      </div>
    </header>
  );
};
