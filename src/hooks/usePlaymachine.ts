import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AppSettings,
  Course,
  CourseAccent,
  Flashcard,
  ImportConfirmPayload,
  LessonBookmark,
  LessonNote,
  PlaymachineDB,
} from '@shared/types';
import { getTodayKey } from '@/lib/format';

const FALLBACK_DB: PlaymachineDB = {
  version: 1,
  courses: [],
  studyLogs: {},
  settings: {
    theme: 'canvas',
    defaultPlaybackRate: 1,
    autoPlayNext: true,
    autoCompleteThreshold: 0.9,
    autoPauseOnNote: true,
    seekStepSeconds: 10,
    dailyGoalMinutes: 30,
    showOriginalFileNames: false,
  },
};

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function usePlaymachine() {
  const [db, setDb] = useState<PlaymachineDB>(FALLBACK_DB);
  const [loaded, setLoaded] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const latestDbRef = useRef<PlaymachineDB>(FALLBACK_DB);

  const persistNow = useCallback((nextDb: PlaymachineDB) => {
    latestDbRef.current = nextDb;
    if (window.playmachine) {
      void window.playmachine.saveDB(nextDb);
    }
  }, []);

  const schedulePersist = useCallback(
    (nextDb: PlaymachineDB, immediate = false) => {
      latestDbRef.current = nextDb;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (immediate) {
        persistNow(nextDb);
        return;
      }
      saveTimerRef.current = window.setTimeout(() => {
        persistNow(latestDbRef.current);
        saveTimerRef.current = null;
      }, 350);
    },
    [persistNow],
  );

  const mutateDB = useCallback(
    (updater: (prev: PlaymachineDB) => PlaymachineDB, immediate = false) => {
      setDb((prev) => {
        const next = updater(prev);
        schedulePersist(next, immediate);
        return next;
      });
    },
    [schedulePersist],
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (window.playmachine) {
          const loadedDb = await window.playmachine.getDB();
          if (active) {
            latestDbRef.current = loadedDb;
            setDb(loadedDb);
            setLoaded(true);
          }
          return;
        }
      } catch (err) {
        console.error('[usePlaymachine] Failed to load DB:', err);
      }
      if (active) setLoaded(true);
    };
    void load();

    const flush = () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        persistNow(latestDbRef.current);
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      active = false;
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, [persistNow]);

  // Apply data-tone attribute for Faddy Canvas (Ivory) vs Ink (Dark) themes
  useEffect(() => {
    document.documentElement.setAttribute('data-tone', db.settings.theme);
  }, [db.settings.theme]);

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      mutateDB(
        (prev) => ({
          ...prev,
          settings: { ...prev.settings, ...patch },
        }),
        true,
      );
    },
    [mutateDB],
  );

  const importCourses = useCallback(async (payload: ImportConfirmPayload) => {
    const updated = await window.playmachine.importCourses(payload);
    latestDbRef.current = updated;
    setDb(updated);
    return updated;
  }, []);

  const rescanCourse = useCallback(async (courseId: string) => {
    const updated = await window.playmachine.rescanCourse(courseId);
    latestDbRef.current = updated;
    setDb(updated);
    return updated;
  }, []);

  const updateCourse = useCallback(
    (courseId: string, updater: (course: Course) => Course, immediate = true) => {
      mutateDB(
        (prev) => ({
          ...prev,
          courses: prev.courses.map((c) => (c.id === courseId ? updater(c) : c)),
        }),
        immediate,
      );
    },
    [mutateDB],
  );

  const deleteCourse = useCallback(
    (courseId: string) => {
      mutateDB(
        (prev) => ({
          ...prev,
          courses: prev.courses.filter((c) => c.id !== courseId),
        }),
        true,
      );
    },
    [mutateDB],
  );

  const toggleCoursePin = useCallback(
    (courseId: string) => {
      updateCourse(courseId, (c) => ({ ...c, pinned: !c.pinned }));
    },
    [updateCourse],
  );

  const updateCourseMeta = useCallback(
    (
      courseId: string,
      patch: Partial<Pick<Course, 'title' | 'description' | 'accent' | 'tags'>>,
    ) => {
      updateCourse(courseId, (c) => ({ ...c, ...patch }));
    },
    [updateCourse],
  );

  const markCourseOpened = useCallback(
    (courseId: string, lessonId?: string) => {
      const now = new Date().toISOString();
      updateCourse(
        courseId,
        (c) => ({
          ...c,
          lastOpenedAt: now,
          lastLessonId: lessonId ?? c.lastLessonId ?? c.sections[0]?.lessons[0]?.id,
        }),
        false,
      );
    },
    [updateCourse],
  );

  const updateLessonProgress = useCallback(
    (
      courseId: string,
      lessonId: string,
      watchedSeconds: number,
      duration: number,
      deltaWatchedSeconds = 0,
    ) => {
      const now = new Date().toISOString();
      const todayKey = getTodayKey();

      mutateDB((prev) => {
        const threshold = prev.settings.autoCompleteThreshold ?? 0.9;
        let newlyCompleted = false;

        const courses = prev.courses.map((course) => {
          if (course.id !== courseId) return course;
          return {
            ...course,
            lastOpenedAt: now,
            lastLessonId: lessonId,
            sections: course.sections.map((section) => ({
              ...section,
              lessons: section.lessons.map((lesson) => {
                if (lesson.id !== lessonId) return lesson;
                const resolvedDuration = duration > 0 ? Math.round(duration) : lesson.duration;
                const shouldComplete =
                  !lesson.completed &&
                  resolvedDuration > 0 &&
                  watchedSeconds / resolvedDuration >= threshold;

                if (shouldComplete) newlyCompleted = true;

                return {
                  ...lesson,
                  duration: resolvedDuration,
                  watchedSeconds: Math.max(0, Math.floor(watchedSeconds)),
                  lastWatchedAt: now,
                  completed: lesson.completed || shouldComplete,
                  completedAt: shouldComplete ? now : lesson.completedAt,
                };
              }),
            })),
          };
        });

        const existingLog = prev.studyLogs[todayKey] ?? {
          date: todayKey,
          secondsWatched: 0,
          lessonsCompleted: 0,
        };

        const studyLogs =
          deltaWatchedSeconds > 0 || newlyCompleted
            ? {
                ...prev.studyLogs,
                [todayKey]: {
                  date: todayKey,
                  secondsWatched: existingLog.secondsWatched + Math.max(0, Math.round(deltaWatchedSeconds)),
                  lessonsCompleted: existingLog.lessonsCompleted + (newlyCompleted ? 1 : 0),
                },
              }
            : prev.studyLogs;

        return {
          ...prev,
          courses,
          studyLogs,
        };
      }, false);
    },
    [mutateDB],
  );

  const toggleLessonComplete = useCallback(
    (courseId: string, lessonId: string, forceValue?: boolean) => {
      const now = new Date().toISOString();
      const todayKey = getTodayKey();

      mutateDB((prev) => {
        let deltaCompleted = 0;

        const courses = prev.courses.map((course) => {
          if (course.id !== courseId) return course;
          return {
            ...course,
            sections: course.sections.map((section) => ({
              ...section,
              lessons: section.lessons.map((lesson) => {
                if (lesson.id !== lessonId) return lesson;
                const nextCompleted = forceValue !== undefined ? forceValue : !lesson.completed;
                if (nextCompleted && !lesson.completed) deltaCompleted = 1;
                if (!nextCompleted && lesson.completed) deltaCompleted = -1;
                return {
                  ...lesson,
                  completed: nextCompleted,
                  completedAt: nextCompleted ? now : undefined,
                };
              }),
            })),
          };
        });

        const existingLog = prev.studyLogs[todayKey] ?? {
          date: todayKey,
          secondsWatched: 0,
          lessonsCompleted: 0,
        };

        const studyLogs =
          deltaCompleted !== 0
            ? {
                ...prev.studyLogs,
                [todayKey]: {
                  ...existingLog,
                  lessonsCompleted: Math.max(0, existingLog.lessonsCompleted + deltaCompleted),
                },
              }
            : prev.studyLogs;

        return { ...prev, courses, studyLogs };
      }, true);
    },
    [mutateDB],
  );

  const renameLesson = useCallback(
    (courseId: string, lessonId: string, newTitle: string) => {
      updateCourse(courseId, (course) => ({
        ...course,
        sections: course.sections.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) =>
            lesson.id === lessonId
              ? { ...lesson, title: newTitle.trim() || lesson.generatedTitle }
              : lesson,
          ),
        })),
      }));
    },
    [updateCourse],
  );

  const renameSection = useCallback(
    (courseId: string, sectionId: string, newTitle: string) => {
      updateCourse(courseId, (course) => ({
        ...course,
        sections: course.sections.map((section) =>
          section.id === sectionId
            ? { ...section, title: newTitle.trim() || section.generatedTitle }
            : section,
        ),
      }));
    },
    [updateCourse],
  );

  const applyProbedDurations = useCallback(
    (courseId: string, durations: Record<string, number>) => {
      if (Object.keys(durations).length === 0) return;
      updateCourse(
        courseId,
        (course) => ({
          ...course,
          sections: course.sections.map((section) => ({
            ...section,
            lessons: section.lessons.map((lesson) => {
              const d = durations[lesson.filePath];
              return d && d > 0 ? { ...lesson, duration: d } : lesson;
            }),
          })),
        }),
        false,
      );
    },
    [updateCourse],
  );

  const addNote = useCallback(
    (
      courseId: string,
      lessonId: string,
      timestamp: number,
      content: string,
      tag?: LessonNote['tag'],
    ) => {
      const now = new Date().toISOString();
      const note: LessonNote = {
        id: makeId('note'),
        timestamp: Math.max(0, Math.floor(timestamp)),
        content: content.trim(),
        tag,
        createdAt: now,
        updatedAt: now,
      };
      updateCourse(courseId, (course) => ({
        ...course,
        sections: course.sections.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) =>
            lesson.id === lessonId
              ? {
                  ...lesson,
                  notes: [...lesson.notes, note].sort((a, b) => a.timestamp - b.timestamp),
                }
              : lesson,
          ),
        })),
      }));
      return note;
    },
    [updateCourse],
  );

  const updateNote = useCallback(
    (courseId: string, lessonId: string, noteId: string, content: string, tag?: LessonNote['tag']) => {
      const now = new Date().toISOString();
      updateCourse(courseId, (course) => ({
        ...course,
        sections: course.sections.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) =>
            lesson.id === lessonId
              ? {
                  ...lesson,
                  notes: lesson.notes.map((n) =>
                    n.id === noteId ? { ...n, content, tag, updatedAt: now } : n,
                  ),
                }
              : lesson,
          ),
        })),
      }));
    },
    [updateCourse],
  );

  const deleteNote = useCallback(
    (courseId: string, lessonId: string, noteId: string) => {
      updateCourse(courseId, (course) => ({
        ...course,
        sections: course.sections.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) =>
            lesson.id === lessonId
              ? { ...lesson, notes: lesson.notes.filter((n) => n.id !== noteId) }
              : lesson,
          ),
        })),
      }));
    },
    [updateCourse],
  );

  const addBookmark = useCallback(
    (courseId: string, lessonId: string, timestamp: number, label: string) => {
      const bm: LessonBookmark = {
        id: makeId('bm'),
        timestamp: Math.max(0, Math.floor(timestamp)),
        label: label.trim() || 'Key moment',
        createdAt: new Date().toISOString(),
      };
      updateCourse(courseId, (course) => ({
        ...course,
        sections: course.sections.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) =>
            lesson.id === lessonId
              ? {
                  ...lesson,
                  bookmarks: [...lesson.bookmarks, bm].sort((a, b) => a.timestamp - b.timestamp),
                }
              : lesson,
          ),
        })),
      }));
      return bm;
    },
    [updateCourse],
  );

  const deleteBookmark = useCallback(
    (courseId: string, lessonId: string, bookmarkId: string) => {
      updateCourse(courseId, (course) => ({
        ...course,
        sections: course.sections.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) =>
            lesson.id === lessonId
              ? { ...lesson, bookmarks: lesson.bookmarks.filter((b) => b.id !== bookmarkId) }
              : lesson,
          ),
        })),
      }));
    },
    [updateCourse],
  );

  const addFlashcard = useCallback(
    (courseId: string, lessonId: string, question: string, answer: string) => {
      const card: Flashcard = {
        id: makeId('fc'),
        question: question.trim(),
        answer: answer.trim(),
        mastered: false,
        createdAt: new Date().toISOString(),
      };
      updateCourse(courseId, (course) => ({
        ...course,
        sections: course.sections.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) =>
            lesson.id === lessonId
              ? { ...lesson, flashcards: [...lesson.flashcards, card] }
              : lesson,
          ),
        })),
      }));
      return card;
    },
    [updateCourse],
  );

  const toggleFlashcardMastered = useCallback(
    (courseId: string, lessonId: string, cardId: string) => {
      updateCourse(courseId, (course) => ({
        ...course,
        sections: course.sections.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) =>
            lesson.id === lessonId
              ? {
                  ...lesson,
                  flashcards: lesson.flashcards.map((fc) =>
                    fc.id === cardId ? { ...fc, mastered: !fc.mastered } : fc,
                  ),
                }
              : lesson,
          ),
        })),
      }));
    },
    [updateCourse],
  );

  const deleteFlashcard = useCallback(
    (courseId: string, lessonId: string, cardId: string) => {
      updateCourse(courseId, (course) => ({
        ...course,
        sections: course.sections.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) =>
            lesson.id === lessonId
              ? { ...lesson, flashcards: lesson.flashcards.filter((fc) => fc.id !== cardId) }
              : lesson,
          ),
        })),
      }));
    },
    [updateCourse],
  );

  const addCourseGoal = useCallback(
    (courseId: string, text: string) => {
      const clean = text.trim();
      if (!clean) return;
      updateCourse(courseId, (course) => ({
        ...course,
        goals: [...course.goals, { id: makeId('goal'), text: clean, done: false }],
      }));
    },
    [updateCourse],
  );

  const toggleCourseGoal = useCallback(
    (courseId: string, goalId: string) => {
      updateCourse(courseId, (course) => ({
        ...course,
        goals: course.goals.map((g) => (g.id === goalId ? { ...g, done: !g.done } : g)),
      }));
    },
    [updateCourse],
  );

  const deleteCourseGoal = useCallback(
    (courseId: string, goalId: string) => {
      updateCourse(courseId, (course) => ({
        ...course,
        goals: course.goals.filter((g) => g.id !== goalId),
      }));
    },
    [updateCourse],
  );

  const replaceDB = useCallback((nextDb: PlaymachineDB) => {
    latestDbRef.current = nextDb;
    setDb(nextDb);
  }, []);

  const changeCourseAccent = useCallback(
    (courseId: string, accent: CourseAccent) => {
      updateCourse(courseId, (c) => ({ ...c, accent }));
    },
    [updateCourse],
  );

  return {
    db,
    loaded,
    updateSettings,
    importCourses,
    rescanCourse,
    deleteCourse,
    toggleCoursePin,
    updateCourseMeta,
    changeCourseAccent,
    markCourseOpened,
    updateLessonProgress,
    toggleLessonComplete,
    renameLesson,
    renameSection,
    applyProbedDurations,
    addNote,
    updateNote,
    deleteNote,
    addBookmark,
    deleteBookmark,
    addFlashcard,
    toggleFlashcardMastered,
    deleteFlashcard,
    addCourseGoal,
    toggleCourseGoal,
    deleteCourseGoal,
    replaceDB,
  };
}
