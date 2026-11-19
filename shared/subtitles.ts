/**
 * Convert SubRip (.srt) subtitle content into standard WebVTT (.vtt) format
 * so HTML5 <video><track> renders local .srt subtitles natively.
 */
export function convertSrtToVtt(srtContent: string): string {
  const normalized = srtContent
    .replace(/^\uFEFF/, '') // Strip UTF-8 BOM
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (normalized.startsWith('WEBVTT')) {
    return normalized;
  }

  const blocks = normalized.split(/\n{2,}/);
  const vttBlocks: string[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line, idx) => !(idx === 0 && /^\d+$/.test(line.trim())));

    if (lines.length === 0) continue;

    // Convert SRT timestamp comma (00:01:23,450) to WebVTT period (00:01:23.450)
    const converted = lines.map((line) =>
      line.replace(
        /(\d{1,2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}),(\d{3})/g,
        (_, start, startMs, end, endMs) =>
          `${padHours(start)}.${startMs} --> ${padHours(end)}.${endMs}`,
      ),
    );

    vttBlocks.push(converted.join('\n'));
  }

  return `WEBVTT\n\n${vttBlocks.join('\n\n')}\n`;
}

function padHours(hms: string): string {
  const parts = hms.split(':');
  if (parts.length === 3 && parts[0].length === 1) {
    return `0${parts[0]}:${parts[1]}:${parts[2]}`;
  }
  return hms;
}
