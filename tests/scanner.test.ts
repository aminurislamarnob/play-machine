import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanDirectoryAsCourse, scanFolderForPreview } from '../electron/scanner';

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('folder scanner', () => {
  it('scans a single multi-module course folder with subtitles and resources', () => {
    const root = createTempDir('pm-course-');
    const courseDir = path.join(root, '01_React_Architecture_Masterclass');
    const mod1 = path.join(courseDir, '01 - Foundations');
    const mod2 = path.join(courseDir, '02 - State Management');
    fs.mkdirSync(mod1, { recursive: true });
    fs.mkdirSync(mod2, { recursive: true });

    fs.writeFileSync(path.join(courseDir, 'syllabus.pdf'), 'pdf-bytes');
    fs.writeFileSync(path.join(mod1, '01_intro_to_jsx_1080p.mp4'), 'video1');
    fs.writeFileSync(path.join(mod1, '01_intro_to_jsx_1080p.en.srt'), '1\n00:00:00,000 --> 00:00:02,000\nHi');
    fs.writeFileSync(path.join(mod1, '02_props_and_composition.mp4'), 'video2');
    fs.writeFileSync(path.join(mod2, '01_useReducer_patterns.mkv'), 'video3');
    fs.writeFileSync(path.join(mod2, 'cheatsheet.md'), '# Notes');

    const preview = scanFolderForPreview(courseDir);
    expect(preview.suggestedMode).toBe('single');
    expect(preview.singleCourse).not.toBeNull();
    expect(preview.singleCourse?.title).toBe('React Architecture Masterclass');
    expect(preview.singleCourse?.sections).toHaveLength(2);
    expect(preview.singleCourse?.sections[0].title).toBe('Foundations');
    expect(preview.singleCourse?.sections[0].lessons[0].title).toBe('Intro to JSX');
    expect(preview.singleCourse?.sections[0].lessons[0].subtitles).toHaveLength(1);
    expect(preview.singleCourse?.sections[1].lessons[0].title).toBe('useReducer Patterns');
    expect(preview.singleCourse?.resources).toHaveLength(1);
    expect(preview.singleCourse?.sections[1].resources).toHaveLength(1);
  });

  it('detects a multi-course collection folder automatically', () => {
    const collectionDir = path.join(createTempDir('pm-col-'), 'My Courses');
    const c1 = path.join(collectionDir, 'TypeScript Deep Dive', '01 - Types');
    const c2 = path.join(collectionDir, 'SwiftUI for macOS', '01 - Views');
    fs.mkdirSync(c1, { recursive: true });
    fs.mkdirSync(c2, { recursive: true });

    fs.writeFileSync(path.join(c1, '01_generics_explained.mp4'), 'v1');
    fs.writeFileSync(path.join(c2, '01_navigation_split_view.mov'), 'v2');

    const preview = scanFolderForPreview(collectionDir);
    expect(preview.canImportAsCollection).toBe(true);
    expect(preview.suggestedMode).toBe('collection');
    expect(preview.collectionCourses).toHaveLength(2);
    const titles = preview.collectionCourses.map((c) => c.title).sort();
    expect(titles).toEqual(['SwiftUI for macOS', 'TypeScript Deep Dive']);
  });

  it('preserves user progress and custom lesson titles on rescan', () => {
    const courseDir = createTempDir('pm-rescan-');
    fs.writeFileSync(path.join(courseDir, '01_getting_started.mp4'), 'v1');

    const initial = scanDirectoryAsCourse(courseDir)!;
    const fakeExisting = {
      id: 'crs_1',
      title: 'My Custom Course Name',
      generatedTitle: initial.generatedTitle,
      folderPath: courseDir,
      accent: 'mint' as const,
      description: 'Notes',
      tags: ['test'],
      pinned: true,
      createdAt: new Date().toISOString(),
      sections: initial.sections.map((s) => ({
        ...s,
        lessons: s.lessons.map((l) => ({
          ...l,
          title: 'Hand Edited Lesson Title',
          completed: true,
          watchedSeconds: 120,
        })),
      })),
      resources: [],
      goals: [],
    };

    // Add a second video to disk
    fs.writeFileSync(path.join(courseDir, '02_building_api.mp4'), 'v2');

    const rescanned = scanDirectoryAsCourse(courseDir, fakeExisting)!;
    expect(rescanned.sections[0].lessons).toHaveLength(2);
    expect(rescanned.sections[0].lessons[0].title).toBe('Hand Edited Lesson Title');
    expect(rescanned.sections[0].lessons[0].completed).toBe(true);
    expect(rescanned.sections[0].lessons[0].watchedSeconds).toBe(120);
    expect(rescanned.sections[0].lessons[1].title).toBe('Building API');
  });
});
