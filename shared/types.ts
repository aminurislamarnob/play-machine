export type CourseAccent = 'mint' | 'teal' | 'peach' | 'iris';

export type AppTheme = 'canvas' | 'ink';

export interface SubtitleTrack {
  id: string;
  label: string;
  lang: string;
  filePath: string;
  format: 'vtt' | 'srt';
}

export interface CourseResource {
  id: string;
  name: string;
  filePath: string;
  ext: string;
  size: number;
  sectionId?: string;
}

export interface LessonNote {
  id: string;
  timestamp: number;
  content: string;
  tag?: 'concept' | 'code' | 'todo' | 'key';
  createdAt: string;
  updatedAt: string;
}

export interface LessonBookmark {
  id: string;
  timestamp: number;
  label: string;
  createdAt: string;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  mastered: boolean;
  createdAt: string;
}

export interface Lesson {
  id: string;
  title: string;
  generatedTitle: string;
  originalFileName: string;
  filePath: string;
  fileSize: number;
  order: number;
  displayIndex: string;
  duration: number;
  watchedSeconds: number;
  completed: boolean;
  completedAt?: string;
  lastWatchedAt?: string;
  subtitles: SubtitleTrack[];
  notes: LessonNote[];
  bookmarks: LessonBookmark[];
  flashcards: Flashcard[];
}

export interface Section {
  id: string;
  title: string;
  generatedTitle: string;
  folderPath: string;
  order: number;
  lessons: Lesson[];
  resources: CourseResource[];
}

export interface CourseGoal {
  id: string;
  text: string;
  done: boolean;
}

export interface Course {
  id: string;
  title: string;
  generatedTitle: string;
  folderPath: string;
  accent: CourseAccent;
  coverPath?: string;
  description: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  lastOpenedAt?: string;
  lastLessonId?: string;
  sections: Section[];
  resources: CourseResource[];
  goals: CourseGoal[];
}

export interface DailyStudyLog {
  date: string; // YYYY-MM-DD
  secondsWatched: number;
  lessonsCompleted: number;
}

export interface AppSettings {
  theme: AppTheme;
  defaultPlaybackRate: number;
  autoPlayNext: boolean;
  autoCompleteThreshold: number; // e.g. 0.9
  autoPauseOnNote: boolean;
  seekStepSeconds: number;
  dailyGoalMinutes: number;
  showOriginalFileNames: boolean;
}

export interface PlaymachineDB {
  version: number;
  courses: Course[];
  studyLogs: Record<string, DailyStudyLog>;
  settings: AppSettings;
}

export type ImportMode = 'single' | 'collection';

export interface ScannedCourseDraft {
  title: string;
  generatedTitle: string;
  folderPath: string;
  accent: CourseAccent;
  coverPath?: string;
  totalVideos: number;
  totalResources: number;
  sections: Section[];
  resources: CourseResource[];
}

export interface FolderScanPreview {
  rootPath: string;
  rootName: string;
  suggestedMode: ImportMode;
  canImportAsCollection: boolean;
  singleCourse: ScannedCourseDraft | null;
  collectionCourses: ScannedCourseDraft[];
}

export interface ImportConfirmPayload {
  mode: ImportMode;
  rootPath: string;
  courses: Array<{
    folderPath: string;
    title: string;
    accent: CourseAccent;
    tags: string[];
  }>;
}

export interface ExportNotesPayload {
  defaultFileName: string;
  markdown: string;
}

export interface PlaymachineAPI {
  getDB: () => Promise<PlaymachineDB>;
  saveDB: (db: PlaymachineDB) => Promise<{ ok: boolean }>;
  pickFolder: () => Promise<string | null>;
  scanFolder: (folderPath: string) => Promise<FolderScanPreview>;
  importCourses: (payload: ImportConfirmPayload) => Promise<PlaymachineDB>;
  rescanCourse: (courseId: string) => Promise<PlaymachineDB>;
  probeDurations: (
    courseId: string,
    filePaths: string[],
  ) => Promise<Record<string, number>>;
  getSubtitleVtt: (filePath: string) => Promise<string>;
  getMediaUrl: (filePath: string) => string;
  revealInFinder: (filePath: string) => Promise<void>;
  openPath: (filePath: string) => Promise<void>;
  exportMarkdown: (payload: ExportNotesPayload) => Promise<{ savedPath: string | null }>;
  exportBackup: () => Promise<{ savedPath: string | null }>;
  importBackup: () => Promise<PlaymachineDB | null>;
  getPathForFile: (file: File) => string;
  onMenuAction: (callback: (action: string) => void) => () => void;
  platform: string;
}
