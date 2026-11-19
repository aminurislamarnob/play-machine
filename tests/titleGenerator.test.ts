import { describe, expect, it } from 'vitest';
import { compareNaturalNames, generateTitleFromName } from '../shared/titleGenerator';

describe('generateTitleFromName', () => {
  it('cleans numbered underscore filenames and preserves technical casing', () => {
    const res = generateTitleFromName('01_introduction_to_typescript.mp4');
    expect(res.numericPrefix).toBe(1);
    expect(res.displayIndex).toBe('01');
    expect(res.title).toBe('Introduction to TypeScript');
  });

  it('strips resolution, codec, and release tags', () => {
    const res = generateTitleFromName('02 - Setting up Next.js and TailwindCSS [1080p].mkv');
    expect(res.numericPrefix).toBe(2);
    expect(res.displayIndex).toBe('02');
    expect(res.title).toBe('Setting up Next.js and Tailwind CSS');
  });

  it('preserves React hooks camelCase while cleaning resolution noise', () => {
    const res = generateTitleFromName('003. useEffect & useCallback Deep Dive (720p_WEB-DL).mp4');
    expect(res.numericPrefix).toBe(3);
    expect(res.displayIndex).toBe('03');
    expect(res.title).toBe('useEffect & useCallback Deep Dive');
  });

  it('handles keyword prefixes like Lesson / Chapter / S01E05', () => {
    expect(
      generateTitleFromName('Lesson 04 - Building a REST API with Node.js (HD).mov'),
    ).toMatchObject({
      numericPrefix: 4,
      displayIndex: '04',
      title: 'Building a REST API with Node.js',
    });

    expect(
      generateTitleFromName('S01E05_DockerComposeBasics_[TutFlix].mp4'),
    ).toMatchObject({
      numericPrefix: 5,
      displayIndex: '05',
      title: 'Docker Compose Basics',
    });
  });

  it('handles macOS / iOS / SwiftUI / CI-CD / trailing video IDs', () => {
    expect(
      generateTitleFromName('10-macOS_SwiftUI_and_iOS_Layouts.mp4'),
    ).toMatchObject({
      numericPrefix: 10,
      displayIndex: '10',
      title: 'macOS SwiftUI and iOS Layouts',
    });

    expect(
      generateTitleFromName('[07] GitHub Actions CI-CD Pipeline_dQw4w9WgXcQ.mp4'),
    ).toMatchObject({
      numericPrefix: 7,
      displayIndex: '07',
      title: 'GitHub Actions CI/CD Pipeline',
    });
  });

  it('handles double prefixes on module folders cleanly', () => {
    const res = generateTitleFromName('01 - Module 01 - Getting Started', 1, { isFolder: true });
    expect(res.numericPrefix).toBe(1);
    expect(res.title).toBe('Getting Started');
  });

  it('falls back cleanly if filename is purely numeric', () => {
    const res = generateTitleFromName('05.mp4', 5);
    expect(res.title).toBe('Lesson 5');
    expect(res.displayIndex).toBe('05');
  });
});

describe('compareNaturalNames', () => {
  it('sorts lessons in natural numeric order (1, 2, 10)', () => {
    const input = ['10_deploy.mp4', '2_setup.mp4', '01_intro.mp4', 'Lesson 3 - hooks.mp4'];
    const sorted = [...input].sort(compareNaturalNames);
    expect(sorted).toEqual([
      '01_intro.mp4',
      '2_setup.mp4',
      'Lesson 3 - hooks.mp4',
      '10_deploy.mp4',
    ]);
  });
});
