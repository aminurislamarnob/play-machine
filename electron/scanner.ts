import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  Course,
  CourseAccent,
  CourseResource,
  FolderScanPreview,
  Lesson,
  ScannedCourseDraft,
  Section,
  SubtitleTrack,
} from '../shared/types';
import {
  compareNaturalNames,
  generateTitleFromName,
  stripVideoExtension,
} from '../shared/titleGenerator';

export const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.m4v',
  '.mkv',
  '.mov',
  '.webm',
  '.avi',
  '.ogv',
]);

const SUBTITLE_EXTENSIONS = new Set(['.vtt', '.srt']);

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);

const RESOURCE_EXTENSIONS = new Set([
  '.pdf',
  '.md',
  '.txt',
  '.zip',
  '.html',
  '.htm',
  '.ipynb',
  '.docx',
  '.pptx',
  '.xlsx',
  '.csv',
  '.json',
  '.fig',
  '.sketch',
  '.epub',
]);

const IGNORED_NAMES = new Set([
  '.DS_Store',
  'Thumbs.db',
  '__MACOSX',
  '.git',
  'node_modules',
  '.idea',
  '.vscode',
]);

const ACCENT_CYCLE: CourseAccent[] = ['mint', 'teal', 'peach', 'iris'];

export function pickAccentForPath(folderPath: string): CourseAccent {
  const hash = crypto.createHash('md5').update(folderPath).digest();
  return ACCENT_CYCLE[hash[0] % ACCENT_CYCLE.length];
}

export function stableId(prefix: string, seed: string): string {
  const hash = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 12);
  return `${prefix}_${hash}`;
}

function safeReadDir(dirPath: string): fs.Dirent[] {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.') && !IGNORED_NAMES.has(entry.name));
  } catch {
    return [];
  }
}

function getFileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function detectCoverImage(dirPath: string, entries: fs.Dirent[]): string | undefined {
  const imageFiles = entries.filter(
    (e) => e.isFile() && IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase()),
  );
  if (imageFiles.length === 0) return undefined;

  const preferred = imageFiles.find((e) =>
    /^(cover|thumb|thumbnail|poster|banner|course|hero)/i.test(e.name),
  );
  return path.join(dirPath, (preferred ?? imageFiles[0]).name);
}

function parseSubtitleLanguage(videoStem: string, subFileName: string): { label: string; lang: string } {
  const ext = path.extname(subFileName);
  const subStem = subFileName.slice(0, -ext.length);
  const suffix = subStem.slice(videoStem.length).replace(/^[\s._-]+/, '');

  if (!suffix) {
    return { label: 'English / Default', lang: 'en' };
  }

  const normalized = suffix.toLowerCase();
  const langMap: Record<string, string> = {
    en: 'English',
    eng: 'English',
    english: 'English',
    es: 'Spanish',
    spa: 'Spanish',
    fr: 'French',
    de: 'German',
    pt: 'Portuguese',
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese',
    ar: 'Arabic',
    bn: 'Bengali',
    hi: 'Hindi',
  };

  const label = langMap[normalized] || suffix.toUpperCase();
  return { label, lang: normalized.slice(0, 5) || 'en' };
}

function findMatchingSubtitles(
  dirPath: string,
  videoFileName: string,
  entries: fs.Dirent[],
): SubtitleTrack[] {
  const videoStem = stripVideoExtension(videoFileName).toLowerCase();
  const tracks: SubtitleTrack[] = [];

  const scanEntriesForSubs = (searchDir: string, dirEntries: fs.Dirent[]) => {
    for (const entry of dirEntries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!SUBTITLE_EXTENSIONS.has(ext)) continue;

      const subStem = entry.name.slice(0, -ext.length).toLowerCase();
      if (
        subStem === videoStem ||
        subStem.startsWith(`${videoStem}.`) ||
        subStem.startsWith(`${videoStem}_`) ||
        subStem.startsWith(`${videoStem}-`) ||
        subStem.startsWith(`${videoStem} `)
      ) {
        const fullPath = path.join(searchDir, entry.name);
        const { label, lang } = parseSubtitleLanguage(videoStem, entry.name);
        tracks.push({
          id: stableId('sub', fullPath),
          label,
          lang,
          filePath: fullPath,
          format: ext === '.vtt' ? 'vtt' : 'srt',
        });
      }
    }
  };

  scanEntriesForSubs(dirPath, entries);

  // Also check a companion "subtitles" / "subs" / "captions" directory if present
  for (const entry of entries) {
    if (entry.isDirectory() && /^(subs?|subtitles|captions|cc)$/i.test(entry.name)) {
      const subDir = path.join(dirPath, entry.name);
      scanEntriesForSubs(subDir, safeReadDir(subDir));
    }
  }

  return tracks;
}

function collectResources(
  dirPath: string,
  entries: fs.Dirent[],
  sectionId?: string,
): CourseResource[] {
  const resources: CourseResource[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!RESOURCE_EXTENSIONS.has(ext)) continue;
    const fullPath = path.join(dirPath, entry.name);
    resources.push({
      id: stableId('res', fullPath),
      name: entry.name,
      filePath: fullPath,
      ext: ext.replace('.', '').toUpperCase(),
      size: getFileSize(fullPath),
      sectionId,
    });
  }
  return resources.sort((a, b) => compareNaturalNames(a.name, b.name));
}

function buildLessonsFromDirectory(
  dirPath: string,
  entries: fs.Dirent[],
  existingLessonByPath?: Map<string, Lesson>,
): Lesson[] {
  const videoEntries = entries
    .filter((e) => e.isFile() && VIDEO_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .sort((a, b) => compareNaturalNames(a.name, b.name));

  return videoEntries.map((entry, idx) => {
    const filePath = path.join(dirPath, entry.name);
    const existing = existingLessonByPath?.get(filePath);
    const generated = generateTitleFromName(entry.name, idx + 1);
    const subtitles = findMatchingSubtitles(dirPath, entry.name, entries);
    const fileSize = getFileSize(filePath);

    if (existing) {
      // Preserve custom user title if they edited it, otherwise refresh generated title
      const userEditedTitle = existing.title !== existing.generatedTitle;
      return {
        ...existing,
        generatedTitle: generated.title,
        title: userEditedTitle ? existing.title : generated.title,
        originalFileName: entry.name,
        fileSize,
        order: idx,
        displayIndex: generated.displayIndex,
        subtitles,
      };
    }

    return {
      id: stableId('les', filePath),
      title: generated.title,
      generatedTitle: generated.title,
      originalFileName: entry.name,
      filePath,
      fileSize,
      order: idx,
      displayIndex: generated.displayIndex,
      duration: 0,
      watchedSeconds: 0,
      completed: false,
      subtitles,
      notes: [],
      bookmarks: [],
      flashcards: [],
    };
  });
}

function collectNestedSections(
  parentPath: string,
  prefixLabel: string,
  depth: number,
  sections: Section[],
  existingSectionByPath?: Map<string, Section>,
  existingLessonByPath?: Map<string, Lesson>,
): void {
  if (depth > 4) return;
  const entries = safeReadDir(parentPath);
  const subdirs = entries
    .filter((e) => e.isDirectory() && !/^(subs?|subtitles|captions|cc)$/i.test(e.name))
    .sort((a, b) => compareNaturalNames(a.name, b.name));

  for (const subdir of subdirs) {
    const subdirPath = path.join(parentPath, subdir.name);
    const subEntries = safeReadDir(subdirPath);
    const lessons = buildLessonsFromDirectory(subdirPath, subEntries, existingLessonByPath);
    const gen = generateTitleFromName(subdir.name, sections.length + 1, { isFolder: true });
    const fullGeneratedTitle = prefixLabel ? `${prefixLabel} / ${gen.title}` : gen.title;
    const sectionId = stableId('sec', subdirPath);
    const resources = collectResources(subdirPath, subEntries, sectionId);

    if (lessons.length > 0) {
      const existingSection = existingSectionByPath?.get(subdirPath);
      const userEditedTitle =
        existingSection && existingSection.title !== existingSection.generatedTitle;

      sections.push({
        id: existingSection?.id ?? sectionId,
        title: userEditedTitle ? existingSection.title : fullGeneratedTitle,
        generatedTitle: fullGeneratedTitle,
        folderPath: subdirPath,
        order: sections.length,
        lessons,
        resources,
      });
    }

    // Recurse into deeper folders if they hold videos
    collectNestedSections(
      subdirPath,
      fullGeneratedTitle,
      depth + 1,
      sections,
      existingSectionByPath,
      existingLessonByPath,
    );
  }
}

/**
 * Scan a directory treating it as ONE course (with either root videos or nested module folders).
 */
export function scanDirectoryAsCourse(
  folderPath: string,
  existingCourse?: Course,
): ScannedCourseDraft | null {
  if (!fs.existsSync(folderPath)) return null;
  const stat = fs.statSync(folderPath);
  if (!stat.isDirectory()) return null;

  const existingSectionByPath = new Map<string, Section>();
  const existingLessonByPath = new Map<string, Lesson>();

  if (existingCourse) {
    for (const sec of existingCourse.sections) {
      existingSectionByPath.set(sec.folderPath, sec);
      for (const les of sec.lessons) {
        existingLessonByPath.set(les.filePath, les);
      }
    }
  }

  const rootEntries = safeReadDir(folderPath);
  const rootName = path.basename(folderPath);
  const courseGen = generateTitleFromName(rootName, 1, { isFolder: true });
  const coverPath = detectCoverImage(folderPath, rootEntries);
  const rootResources = collectResources(folderPath, rootEntries);

  const sections: Section[] = [];

  // 1. Direct videos in the course root folder
  const rootLessons = buildLessonsFromDirectory(folderPath, rootEntries, existingLessonByPath);
  if (rootLessons.length > 0) {
    const existingRoot = existingSectionByPath.get(folderPath);
    const defaultTitle = 'Course Lessons';
    const userEdited = existingRoot && existingRoot.title !== existingRoot.generatedTitle;
    sections.push({
      id: existingRoot?.id ?? stableId('sec', folderPath),
      title: userEdited ? existingRoot.title : defaultTitle,
      generatedTitle: defaultTitle,
      folderPath,
      order: 0,
      lessons: rootLessons,
      resources: [],
    });
  }

  // 2. Subfolder modules
  collectNestedSections(
    folderPath,
    '',
    0,
    sections,
    existingSectionByPath,
    existingLessonByPath,
  );

  // If root had videos AND there are subfolders, name the root section "Introduction & Overview"
  if (rootLessons.length > 0 && sections.length > 1) {
    const existingRoot = existingSectionByPath.get(folderPath);
    const userEdited = existingRoot && existingRoot.title !== existingRoot.generatedTitle;
    sections[0].generatedTitle = 'Introduction & Overview';
    if (!userEdited) {
      sections[0].title = 'Introduction & Overview';
    }
  }

  const totalVideos = sections.reduce((sum, sec) => sum + sec.lessons.length, 0);
  if (totalVideos === 0) return null;

  const totalResources =
    rootResources.length + sections.reduce((sum, sec) => sum + sec.resources.length, 0);

  return {
    title: existingCourse?.title ?? courseGen.title,
    generatedTitle: courseGen.title,
    folderPath,
    accent: existingCourse?.accent ?? pickAccentForPath(folderPath),
    coverPath: coverPath ?? existingCourse?.coverPath,
    totalVideos,
    totalResources,
    sections,
    resources: rootResources,
  };
}

/**
 * Preview a folder chosen by the user, supporting both:
 *  - Single Course (root + module subfolders)
 *  - Collection of Courses (each subfolder becomes a separate course)
 */
export function scanFolderForPreview(rootPath: string): FolderScanPreview {
  const rootName = path.basename(rootPath);
  const rootEntries = safeReadDir(rootPath);
  const rootDirectVideos = rootEntries.filter(
    (e) => e.isFile() && VIDEO_EXTENSIONS.has(path.extname(e.name).toLowerCase()),
  );

  const singleCourse = scanDirectoryAsCourse(rootPath);

  const subdirs = rootEntries
    .filter((e) => e.isDirectory() && !/^(subs?|subtitles|captions|cc)$/i.test(e.name))
    .sort((a, b) => compareNaturalNames(a.name, b.name));

  const collectionCourses: ScannedCourseDraft[] = [];
  for (const subdir of subdirs) {
    const draft = scanDirectoryAsCourse(path.join(rootPath, subdir.name));
    if (draft) {
      collectionCourses.push(draft);
    }
  }

  const canImportAsCollection = collectionCourses.length >= 2;

  // Smart heuristic to suggest Collection vs Single Course:
  // Suggest collection when root has NO direct videos AND either:
  //  - at least one child subfolder itself has multiple sections (e.g. Courses/React/01-Intro/...)
  //  - OR the root folder name looks like a container (courses, library, tutorials, videos, collection)
  //  - OR child subfolder names do NOT look like numbered course modules (01 - ..., Module 1, Section 2)
  let suggestedMode: 'single' | 'collection' = 'single';
  if (canImportAsCollection && rootDirectVideos.length === 0) {
    const anyChildHasMultiSections = collectionCourses.some((c) => c.sections.length >= 2);
    const rootLooksLikeCollection =
      /(courses?|library|collection|tutorials?|bootcamp|videos?|learning|classes|playlists?)/i.test(
        rootName,
      );
    const childrenLookLikeModules = subdirs.every((d) =>
      /^(?:0*\d+[\s._\-)]|module|section|chapter|part|week|day|unit)/i.test(d.name),
    );

    if (anyChildHasMultiSections || rootLooksLikeCollection || !childrenLookLikeModules) {
      suggestedMode = 'collection';
    }
  }

  return {
    rootPath,
    rootName,
    suggestedMode,
    canImportAsCollection,
    singleCourse,
    collectionCourses,
  };
}
