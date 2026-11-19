import type { Course, CourseAccent, Lesson, Section } from '@shared/types';
import { formatDuration } from './format';

export interface CourseStats {
  totalLessons: number;
  completedLessons: number;
  totalDuration: number;
  watchedDuration: number;
  progressPercent: number;
  totalNotes: number;
  totalBookmarks: number;
  totalFlashcards: number;
  totalResources: number;
  status: 'not-started' | 'in-progress' | 'completed';
}

export function getAllLessons(course: Course): Lesson[] {
  return course.sections.flatMap((s) => s.lessons);
}

export function findLessonInCourse(
  course: Course,
  lessonId?: string,
): { section: Section; lesson: Lesson; flatIndex: number } | null {
  const flat: Array<{ section: Section; lesson: Lesson }> = [];
  for (const section of course.sections) {
    for (const lesson of section.lessons) {
      flat.push({ section, lesson });
    }
  }
  if (flat.length === 0) return null;

  if (lessonId) {
    const idx = flat.findIndex((item) => item.lesson.id === lessonId);
    if (idx >= 0) return { ...flat[idx], flatIndex: idx };
  }
  return { ...flat[0], flatIndex: 0 };
}

export function getAdjacentLessons(
  course: Course,
  currentLessonId: string,
): { prev: Lesson | null; next: Lesson | null } {
  const flat = getAllLessons(course);
  const idx = flat.findIndex((l) => l.id === currentLessonId);
  if (idx < 0) return { prev: null, next: null };
  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx < flat.length - 1 ? flat[idx + 1] : null,
  };
}

export function getCourseStats(course: Course): CourseStats {
  const lessons = getAllLessons(course);
  const totalLessons = lessons.length;
  let completedLessons = 0;
  let totalDuration = 0;
  let watchedDuration = 0;
  let totalNotes = 0;
  let totalBookmarks = 0;
  let totalFlashcards = 0;
  let anyStarted = false;

  for (const l of lessons) {
    if (l.completed) completedLessons++;
    if (l.watchedSeconds > 5 || l.completed) anyStarted = true;
    totalDuration += l.duration || 0;
    watchedDuration += l.completed ? l.duration || l.watchedSeconds : Math.min(l.watchedSeconds, l.duration || l.watchedSeconds);
    totalNotes += l.notes.length;
    totalBookmarks += l.bookmarks.length;
    totalFlashcards += l.flashcards.length;
  }

  const totalResources =
    course.resources.length +
    course.sections.reduce((acc, s) => acc + s.resources.length, 0);

  const progressPercent =
    totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

  const status: CourseStats['status'] =
    totalLessons > 0 && completedLessons === totalLessons
      ? 'completed'
      : anyStarted || completedLessons > 0
        ? 'in-progress'
        : 'not-started';

  return {
    totalLessons,
    completedLessons,
    totalDuration,
    watchedDuration,
    progressPercent,
    totalNotes,
    totalBookmarks,
    totalFlashcards,
    totalResources,
    status,
  };
}

export function getAccentClasses(accent: CourseAccent): {
  bg: string;
  badge: string;
  shadow: string;
  bar: string;
  dot: string;
} {
  switch (accent) {
    case 'mint':
      return {
        bg: 'bg-mint',
        badge: 'bg-mint-soft text-ink border-ink/20',
        shadow: 'shadow-offset-mint',
        bar: 'bg-teal',
        dot: 'bg-mint',
      };
    case 'teal':
      return {
        bg: 'bg-teal',
        badge: 'bg-teal/20 text-ink border-teal/40',
        shadow: 'shadow-offset-teal',
        bar: 'bg-iris',
        dot: 'bg-teal',
      };
    case 'peach':
      return {
        bg: 'bg-peach',
        badge: 'bg-peach/25 text-ink border-peach/50',
        shadow: 'shadow-offset-peach',
        bar: 'bg-peach',
        dot: 'bg-peach',
      };
    case 'iris':
      return {
        bg: 'bg-iris',
        badge: 'bg-iris/15 text-iris-ink border-iris/30',
        shadow: 'shadow-offset-iris',
        bar: 'bg-iris',
        dot: 'bg-iris',
      };
  }
}

export function buildCourseNotesMarkdown(course: Course): string {
  const stats = getCourseStats(course);
  const lines: string[] = [
    `# ${course.title} — Study Notes`,
    '',
    `> Exported from Playmachine · ${stats.completedLessons}/${stats.totalLessons} lessons completed (${stats.progressPercent}%)`,
    '',
  ];

  for (const section of course.sections) {
    const lessonsWithContent = section.lessons.filter(
      (l) => l.notes.length > 0 || l.bookmarks.length > 0 || l.flashcards.length > 0,
    );
    if (lessonsWithContent.length === 0) continue;

    lines.push(`## ${section.title}`, '');

    for (const lesson of lessonsWithContent) {
      lines.push(`### ${lesson.displayIndex}. ${lesson.title}`, '');

      if (lesson.notes.length > 0) {
        const sortedNotes = [...lesson.notes].sort((a, b) => a.timestamp - b.timestamp);
        for (const note of sortedNotes) {
          const tag = note.tag ? ` [${note.tag.toUpperCase()}]` : '';
          lines.push(`- **\`${formatDuration(note.timestamp)}\`**${tag} — ${note.content}`);
        }
        lines.push('');
      }

      if (lesson.bookmarks.length > 0) {
        lines.push('**Bookmarks:**');
        for (const bm of [...lesson.bookmarks].sort((a, b) => a.timestamp - b.timestamp)) {
          lines.push(`- \`${formatDuration(bm.timestamp)}\` ${bm.label}`);
        }
        lines.push('');
      }

      if (lesson.flashcards.length > 0) {
        lines.push('**Review Cards:**');
        for (const fc of lesson.flashcards) {
          lines.push(`- **Q:** ${fc.question}  \n  **A:** ${fc.answer}`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}
