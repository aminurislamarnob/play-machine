import { execFile } from 'node:child_process';
import fs from 'node:fs';

let cachedFfprobePath: string | null | undefined;

function findFfprobe(): string | null {
  if (cachedFfprobePath !== undefined) return cachedFfprobePath;

  const candidates = [
    '/opt/homebrew/bin/ffprobe',
    '/usr/local/bin/ffprobe',
    '/usr/bin/ffprobe',
    'ffprobe',
  ];

  for (const candidate of candidates) {
    if (candidate === 'ffprobe' || fs.existsSync(candidate)) {
      cachedFfprobePath = candidate;
      return candidate;
    }
  }

  cachedFfprobePath = null;
  return null;
}

export function probeVideoDuration(filePath: string): Promise<number> {
  const bin = findFfprobe();
  if (!bin) return Promise.resolve(0);

  return new Promise((resolve) => {
    execFile(
      bin,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ],
      { timeout: 6000 },
      (err, stdout) => {
        if (err) {
          resolve(0);
          return;
        }
        const parsed = parseFloat(stdout.trim());
        resolve(Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0);
      },
    );
  });
}

export async function probeDurationsBatch(
  filePaths: string[],
  concurrency = 4,
): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  if (!findFfprobe() || filePaths.length === 0) return results;

  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, filePaths.length) }, async () => {
    while (cursor < filePaths.length) {
      const idx = cursor++;
      const fp = filePaths[idx];
      const dur = await probeVideoDuration(fp);
      if (dur > 0) {
        results[fp] = dur;
      }
    }
  });

  await Promise.all(workers);
  return results;
}
