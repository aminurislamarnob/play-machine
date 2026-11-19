import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { FolderScanPreview, ImportConfirmPayload } from '@shared/types';
import { usePlaymachine } from './hooks/usePlaymachine';
import { TitleBar, type ActiveRoute } from './components/TitleBar';
import { NavRail } from './components/NavRail';
import { LibraryView } from './components/LibraryView';
import { CoursePlayerView } from './components/CoursePlayerView';
import { NotesHubView } from './components/NotesHubView';
import { ActivityView } from './components/ActivityView';
import { SettingsView } from './components/SettingsView';
import { ImportModal } from './components/ImportModal';
import { CommandPalette } from './components/CommandPalette';
import { ToastStack, type ToastMessage } from './components/ui/Toast';
import { findLessonInCourse } from './lib/courseHelpers';

export const App: React.FC = () => {
  const pm = usePlaymachine();
  const [route, setRoute] = useState<ActiveRoute>('library');
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [pendingSeek, setPendingSeek] = useState<number | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [scanPreview, setScanPreview] = useState<FolderScanPreview | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((text: string, tone: ToastMessage['tone'] = 'mint') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const activeCourse = useMemo(
    () => pm.db.courses.find((c) => c.id === activeCourseId),
    [pm.db.courses, activeCourseId],
  );

  const activeLesson = useMemo(() => {
    if (!activeCourse) return undefined;
    return findLessonInCourse(activeCourse, activeLessonId ?? activeCourse.lastLessonId)?.lesson;
  }, [activeCourse, activeLessonId]);

  const scanPathForImport = useCallback(
    async (folderPath: string) => {
      if (!window.playmachine) return;
      setScanLoading(true);
      try {
        const preview = await window.playmachine.scanFolder(folderPath);
        setScanPreview(preview);
      } catch (err) {
        console.error('[scanFolder] error:', err);
        pushToast('Failed to scan selected folder', 'peach');
      } finally {
        setScanLoading(false);
      }
    },
    [pushToast],
  );

  const handlePickFolder = useCallback(async () => {
    if (!window.playmachine) return;
    const folderPath = await window.playmachine.pickFolder();
    if (!folderPath) return;
    await scanPathForImport(folderPath);
  }, [scanPathForImport]);

  const handleConfirmImport = useCallback(
    async (payload: ImportConfirmPayload) => {
      const updated = await pm.importCourses(payload);
      setScanPreview(null);
      const count = payload.courses.length;
      pushToast(
        count === 1
          ? `Imported “${payload.courses[0].title}”`
          : `Imported ${count} courses from collection`,
        'mint',
      );

      // If user imported a single course, open it straight away for instant delight
      if (count === 1) {
        const imported = updated.courses.find(
          (c) => c.folderPath === payload.courses[0].folderPath,
        );
        if (imported) {
          const firstLesson = imported.sections[0]?.lessons[0]?.id ?? null;
          setActiveCourseId(imported.id);
          setActiveLessonId(firstLesson);
          setRoute('player');
        }
      }
    },
    [pm, pushToast],
  );

  const handleOpenCourse = useCallback(
    (courseId: string, lessonId?: string, seekTime?: number) => {
      const course = pm.db.courses.find((c) => c.id === courseId);
      if (!course) return;
      const target = findLessonInCourse(course, lessonId ?? course.lastLessonId);
      const resolvedLessonId = target?.lesson.id ?? null;

      setActiveCourseId(courseId);
      setActiveLessonId(resolvedLessonId);
      if (seekTime !== undefined) {
        setPendingSeek(seekTime);
      }
      setRoute('player');
      pm.markCourseOpened(courseId, resolvedLessonId ?? undefined);
    },
    [pm],
  );

  const handleToggleTheme = useCallback(() => {
    const next = pm.db.settings.theme === 'canvas' ? 'ink' : 'canvas';
    pm.updateSettings({ theme: next });
    pushToast(next === 'ink' ? 'Oceanic Ink theme active' : 'Ivory Canvas theme active', 'ink');
  }, [pm, pushToast]);

  const handleToggleFocus = useCallback(() => {
    setFocusMode((prev) => {
      const next = !prev;
      if (next) setSidebarOpen(false);
      else setSidebarOpen(true);
      return next;
    });
  }, []);

  // Native macOS Menu IPC actions + Global shortcuts (⌘K, ⌘O)
  useEffect(() => {
    const offMenu = window.playmachine?.onMenuAction((action) => {
      switch (action) {
        case 'import-folder':
          void handlePickFolder();
          break;
        case 'open-command-palette':
          setPaletteOpen((o) => !o);
          break;
        case 'nav-library':
          setFocusMode(false);
          setRoute('library');
          break;
        case 'nav-notes':
          setFocusMode(false);
          setRoute('notes');
          break;
        case 'nav-activity':
          setFocusMode(false);
          setRoute('activity');
          break;
        case 'open-settings':
          setFocusMode(false);
          setRoute('settings');
          break;
        case 'toggle-focus':
          handleToggleFocus();
          break;
        case 'toggle-theme':
          handleToggleTheme();
          break;
      }
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        void handlePickFolder();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      offMenu?.();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handlePickFolder, handleToggleFocus, handleToggleTheme]);

  if (!pm.loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas text-xs font-mono text-fg-muted">
        Loading Playmachine…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas text-fg">
      <TitleBar
        route={route}
        activeCourse={activeCourse}
        activeLesson={activeLesson}
        theme={pm.db.settings.theme}
        sidebarOpen={sidebarOpen && !focusMode}
        focusMode={focusMode}
        onToggleSidebar={() => {
          if (focusMode) setFocusMode(false);
          setSidebarOpen((s) => !s);
        }}
        onToggleFocus={handleToggleFocus}
        onToggleTheme={handleToggleTheme}
        onOpenImport={() => void handlePickFolder()}
        onOpenPalette={() => setPaletteOpen(true)}
        onNavigate={(nextRoute) => {
          if (nextRoute !== 'player') setFocusMode(false);
          setRoute(nextRoute);
        }}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {sidebarOpen && !focusMode && (
          <NavRail
            route={route}
            courses={pm.db.courses}
            activeCourseId={activeCourseId}
            studyLogs={pm.db.studyLogs}
            dailyGoalMinutes={pm.db.settings.dailyGoalMinutes}
            onNavigate={(r) => setRoute(r)}
            onOpenCourse={(id) => handleOpenCourse(id)}
            onOpenImport={() => void handlePickFolder()}
          />
        )}

        <main className="min-w-0 flex-1 overflow-hidden">
          {route === 'library' && (
            <LibraryView
              courses={pm.db.courses}
              studyLogs={pm.db.studyLogs}
              dailyGoalMinutes={pm.db.settings.dailyGoalMinutes}
              onPickFolder={() => void handlePickFolder()}
              onDropFolderPath={(p) => void scanPathForImport(p)}
              onOpenCourse={(id, lessonId) => handleOpenCourse(id, lessonId)}
              onTogglePin={(id) => {
                pm.toggleCoursePin(id);
                pushToast('Updated pinned courses', 'mint');
              }}
              onRescanCourse={(id) => {
                void pm.rescanCourse(id).then(() => pushToast('Course folder rescanned', 'mint'));
              }}
              onDeleteCourse={(id) => {
                pm.deleteCourse(id);
                if (activeCourseId === id) {
                  setActiveCourseId(null);
                  setActiveLessonId(null);
                }
                pushToast('Removed course from library (files untouched)', 'peach');
              }}
            />
          )}

          {route === 'player' && activeCourse && activeLesson && (
            <CoursePlayerView
              course={activeCourse}
              activeLessonId={activeLesson.id}
              settings={pm.db.settings}
              focusMode={focusMode}
              pendingSeekSeconds={pendingSeek}
              onPendingSeekConsumed={() => setPendingSeek(null)}
              onSelectLesson={(lessonId) => {
                setActiveLessonId(lessonId);
                pm.markCourseOpened(activeCourse.id, lessonId);
              }}
              onToggleFocus={handleToggleFocus}
              onProgress={(lessonId, watched, dur, delta) =>
                pm.updateLessonProgress(activeCourse.id, lessonId, watched, dur, delta)
              }
              onToggleComplete={(lessonId) => pm.toggleLessonComplete(activeCourse.id, lessonId)}
              onRenameLesson={(lessonId, newTitle) => {
                pm.renameLesson(activeCourse.id, lessonId, newTitle);
                pushToast('Lesson title updated', 'mint');
              }}
              onRenameSection={(sectionId, newTitle) => {
                pm.renameSection(activeCourse.id, sectionId, newTitle);
                pushToast('Module title updated', 'mint');
              }}
              onApplyProbedDurations={(durations) =>
                pm.applyProbedDurations(activeCourse.id, durations)
              }
              onRescanCourse={() => {
                void pm
                  .rescanCourse(activeCourse.id)
                  .then(() => pushToast('Folder rescanned & syllabus refreshed', 'mint'));
              }}
              onAddNote={(lessonId, ts, content, tag) =>
                pm.addNote(activeCourse.id, lessonId, ts, content, tag)
              }
              onDeleteNote={(lessonId, noteId) => pm.deleteNote(activeCourse.id, lessonId, noteId)}
              onAddBookmark={(lessonId, ts, label) =>
                pm.addBookmark(activeCourse.id, lessonId, ts, label)
              }
              onDeleteBookmark={(lessonId, bmId) =>
                pm.deleteBookmark(activeCourse.id, lessonId, bmId)
              }
              onAddFlashcard={(lessonId, q, a) => pm.addFlashcard(activeCourse.id, lessonId, q, a)}
              onToggleFlashcardMastered={(lessonId, cardId) =>
                pm.toggleFlashcardMastered(activeCourse.id, lessonId, cardId)
              }
              onDeleteFlashcard={(lessonId, cardId) =>
                pm.deleteFlashcard(activeCourse.id, lessonId, cardId)
              }
              onAddGoal={(text) => pm.addCourseGoal(activeCourse.id, text)}
              onToggleGoal={(goalId) => pm.toggleCourseGoal(activeCourse.id, goalId)}
              onDeleteGoal={(goalId) => pm.deleteCourseGoal(activeCourse.id, goalId)}
              onUpdateDescription={(description) =>
                pm.updateCourseMeta(activeCourse.id, { description })
              }
              onToast={pushToast}
            />
          )}

          {route === 'notes' && (
            <NotesHubView
              courses={pm.db.courses}
              onJumpToLesson={(courseId, lessonId, ts) => handleOpenCourse(courseId, lessonId, ts)}
              onToast={pushToast}
            />
          )}

          {route === 'activity' && (
            <ActivityView
              courses={pm.db.courses}
              studyLogs={pm.db.studyLogs}
              dailyGoalMinutes={pm.db.settings.dailyGoalMinutes}
              onOpenCourse={(id) => handleOpenCourse(id)}
            />
          )}

          {route === 'settings' && (
            <SettingsView
              settings={pm.db.settings}
              onUpdateSettings={pm.updateSettings}
              onReplaceDB={pm.replaceDB}
              onToast={pushToast}
            />
          )}
        </main>
      </div>

      <ImportModal
        preview={scanPreview}
        loading={scanLoading}
        onClose={() => setScanPreview(null)}
        onPickAnotherFolder={() => void handlePickFolder()}
        onConfirm={handleConfirmImport}
      />

      <CommandPalette
        open={paletteOpen}
        courses={pm.db.courses}
        theme={pm.db.settings.theme}
        onClose={() => setPaletteOpen(false)}
        onSelectLesson={(courseId, lessonId, seekTime) =>
          handleOpenCourse(courseId, lessonId, seekTime)
        }
        onImportFolder={() => void handlePickFolder()}
        onToggleTheme={handleToggleTheme}
      />

      <ToastStack toasts={toasts} />
    </div>
  );
};
