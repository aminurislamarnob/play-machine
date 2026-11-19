import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AppSettings, Course, LessonNote } from '@shared/types';
import {
  buildCourseNotesMarkdown,
  findLessonInCourse,
  getAdjacentLessons,
  getAllLessons,
} from '@/lib/courseHelpers';
import { VideoPlayer, type VideoPlayerHandle } from './VideoPlayer';
import { CurriculumSidebar } from './CurriculumSidebar';
import { LessonWorkspace, type WorkspaceTab } from './LessonWorkspace';
import { Button } from './ui/Button';

interface CoursePlayerViewProps {
  course: Course;
  activeLessonId: string;
  settings: AppSettings;
  focusMode: boolean;
  pendingSeekSeconds: number | null;
  onPendingSeekConsumed: () => void;
  onSelectLesson: (lessonId: string) => void;
  onToggleFocus: () => void;
  onProgress: (lessonId: string, watched: number, duration: number, delta: number) => void;
  onToggleComplete: (lessonId: string) => void;
  onRenameLesson: (lessonId: string, newTitle: string) => void;
  onRenameSection: (sectionId: string, newTitle: string) => void;
  onApplyProbedDurations: (durations: Record<string, number>) => void;
  onRescanCourse: () => void;
  onAddNote: (lessonId: string, timestamp: number, content: string, tag?: LessonNote['tag']) => void;
  onDeleteNote: (lessonId: string, noteId: string) => void;
  onAddBookmark: (lessonId: string, timestamp: number, label: string) => void;
  onDeleteBookmark: (lessonId: string, bookmarkId: string) => void;
  onAddFlashcard: (lessonId: string, question: string, answer: string) => void;
  onToggleFlashcardMastered: (lessonId: string, cardId: string) => void;
  onDeleteFlashcard: (lessonId: string, cardId: string) => void;
  onAddGoal: (text: string) => void;
  onToggleGoal: (goalId: string) => void;
  onDeleteGoal: (goalId: string) => void;
  onUpdateDescription: (description: string) => void;
  onToast: (msg: string, tone?: 'mint' | 'peach' | 'ink') => void;
}

export const CoursePlayerView: React.FC<CoursePlayerViewProps> = ({
  course,
  activeLessonId,
  settings,
  focusMode,
  pendingSeekSeconds,
  onPendingSeekConsumed,
  onSelectLesson,
  onToggleFocus,
  onProgress,
  onToggleComplete,
  onRenameLesson,
  onRenameSection,
  onApplyProbedDurations,
  onRescanCourse,
  onAddNote,
  onDeleteNote,
  onAddBookmark,
  onDeleteBookmark,
  onAddFlashcard,
  onToggleFlashcardMastered,
  onDeleteFlashcard,
  onAddGoal,
  onToggleGoal,
  onDeleteGoal,
  onUpdateDescription,
  onToast,
}) => {
  const playerRef = useRef<VideoPlayerHandle>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('overview');
  const [liveTime, setLiveTime] = useState(0);
  const [noteFocusSignal, setNoteFocusSignal] = useState(0);
  const probedCourseRef = useRef<string | null>(null);

  const located = useMemo(
    () => findLessonInCourse(course, activeLessonId),
    [course, activeLessonId],
  );

  const adjacent = useMemo(
    () => (located ? getAdjacentLessons(course, located.lesson.id) : { prev: null, next: null }),
    [course, located],
  );

  // Background duration probing via optional ffprobe for crisp syllabus total durations
  useEffect(() => {
    if (probedCourseRef.current === course.id) return;
    const missing = getAllLessons(course)
      .filter((l) => !l.duration || l.duration <= 0)
      .map((l) => l.filePath);

    probedCourseRef.current = course.id;
    if (missing.length === 0 || !window.playmachine) return;

    void window.playmachine
      .probeDurations(course.id, missing)
      .then((durations) => {
        if (durations && Object.keys(durations).length > 0) {
          onApplyProbedDurations(durations);
        }
      })
      .catch(() => {});
  }, [course, onApplyProbedDurations]);

  const handleExportNotes = async () => {
    const md = buildCourseNotesMarkdown(course);
    const safeName = `${course.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-notes.md`;
    const res = await window.playmachine?.exportMarkdown({
      defaultFileName: safeName,
      markdown: md,
    });
    if (res?.savedPath) {
      onToast(`Exported notes to ${res.savedPath.split('/').pop()}`, 'mint');
    }
  };

  if (!located) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-sm text-fg-muted">
        No lessons found in this course folder. Try rescanning the folder.
      </div>
    );
  }

  const { section, lesson } = located;

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-canvas">
      {/* Main Player + Tabbed LMS Workspace */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className={`mx-auto p-4 sm:p-5 ${focusMode ? 'max-w-6xl' : 'max-w-5xl'}`}>
          <VideoPlayer
            ref={playerRef}
            lesson={lesson}
            settings={settings}
            hasPrev={Boolean(adjacent.prev)}
            hasNext={Boolean(adjacent.next)}
            nextLessonTitle={adjacent.next?.title}
            initialSeekSeconds={pendingSeekSeconds}
            onInitialSeekConsumed={onPendingSeekConsumed}
            onProgress={(watched, dur, delta) => onProgress(lesson.id, watched, dur, delta)}
            onTimeUpdate={setLiveTime}
            onPrevLesson={() => adjacent.prev && onSelectLesson(adjacent.prev.id)}
            onNextLesson={() => adjacent.next && onSelectLesson(adjacent.next.id)}
            onQuickBookmark={(ts) => {
              onAddBookmark(lesson.id, ts, `Moment in ${lesson.title}`);
              onToast(`Bookmarked @ ${Math.floor(ts / 60)}:${String(Math.floor(ts % 60)).padStart(2, '0')}`, 'mint');
            }}
            onQuickNote={() => {
              setWorkspaceTab('notes');
              setNoteFocusSignal((n) => n + 1);
            }}
            onToggleFocus={onToggleFocus}
          />

          {/* Prev / Next Lesson Quick Strip */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              variant="ivory"
              size="xs"
              disabled={!adjacent.prev}
              onClick={() => adjacent.prev && onSelectLesson(adjacent.prev.id)}
            >
              <ChevronLeft className="size-3.5" />
              <span className="max-w-[200px] truncate">
                {adjacent.prev ? `${adjacent.prev.displayIndex}. ${adjacent.prev.title}` : 'Start of course'}
              </span>
            </Button>

            <span className="hidden font-mono text-[10px] text-fg-muted md:inline">
              Space Play · ←/→ Seek · N Note · B Pin · [ / ] Speed · T Focus
            </span>

            <Button
              variant="ink"
              size="xs"
              disabled={!adjacent.next}
              onClick={() => adjacent.next && onSelectLesson(adjacent.next.id)}
            >
              <span className="max-w-[200px] truncate">
                {adjacent.next ? `${adjacent.next.displayIndex}. ${adjacent.next.title}` : 'Course finale'}
              </span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>

          <LessonWorkspace
            course={course}
            section={section}
            lesson={lesson}
            activeTab={workspaceTab}
            currentPlaybackSeconds={liveTime}
            noteFocusSignal={noteFocusSignal}
            autoPauseOnNote={settings.autoPauseOnNote}
            onChangeTab={setWorkspaceTab}
            onSeekTo={(sec) => playerRef.current?.seekTo(sec, true)}
            onPauseVideo={() => playerRef.current?.pause()}
            onToggleComplete={() => onToggleComplete(lesson.id)}
            onRenameLesson={(newTitle) => onRenameLesson(lesson.id, newTitle)}
            onAddNote={(ts, content, tag) => {
              onAddNote(lesson.id, ts, content, tag);
              onToast('Note saved', 'mint');
            }}
            onDeleteNote={(noteId) => onDeleteNote(lesson.id, noteId)}
            onAddBookmark={(ts, label) => {
              onAddBookmark(lesson.id, ts, label);
              onToast('Bookmark added', 'mint');
            }}
            onDeleteBookmark={(bmId) => onDeleteBookmark(lesson.id, bmId)}
            onAddFlashcard={(q, a) => {
              onAddFlashcard(lesson.id, q, a);
              onToast('Review card added', 'mint');
            }}
            onToggleFlashcardMastered={(cardId) =>
              onToggleFlashcardMastered(lesson.id, cardId)
            }
            onDeleteFlashcard={(cardId) => onDeleteFlashcard(lesson.id, cardId)}
            onAddGoal={onAddGoal}
            onToggleGoal={onToggleGoal}
            onDeleteGoal={onDeleteGoal}
            onUpdateDescription={onUpdateDescription}
            onExportNotes={handleExportNotes}
          />
        </div>
      </div>

      {/* Collapsible Curriculum Sidebar */}
      {!focusMode && (
        <CurriculumSidebar
          course={course}
          activeLessonId={lesson.id}
          showOriginalFileNames={settings.showOriginalFileNames}
          onSelectLesson={onSelectLesson}
          onToggleComplete={onToggleComplete}
          onRenameLesson={onRenameLesson}
          onRenameSection={onRenameSection}
          onRescanCourse={onRescanCourse}
          onExportNotes={handleExportNotes}
        />
      )}
    </div>
  );
};
