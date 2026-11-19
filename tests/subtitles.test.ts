import { describe, expect, it } from 'vitest';
import { convertSrtToVtt } from '../shared/subtitles';

describe('convertSrtToVtt', () => {
  it('converts standard SRT cues and comma timestamps to WebVTT', () => {
    const srt = [
      '1',
      '00:00:01,250 --> 00:00:04,500',
      'Welcome to the course!',
      '',
      '2',
      '00:00:05,000 --> 00:00:08,100',
      'Today we build a local LMS.',
    ].join('\n');

    const vtt = convertSrtToVtt(srt);
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toContain('00:00:01.250 --> 00:00:04.500');
    expect(vtt).toContain('Welcome to the course!');
    expect(vtt).toContain('00:00:05.000 --> 00:00:08.100');
  });

  it('passes through existing WebVTT content intact', () => {
    const input = 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHello';
    expect(convertSrtToVtt(input)).toBe(input);
  });
});
