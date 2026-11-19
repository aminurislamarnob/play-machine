import fs from 'node:fs';
import path from 'node:path';
import type { AppSettings, PlaymachineDB } from '../shared/types';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'canvas',
  defaultPlaybackRate: 1,
  autoPlayNext: true,
  autoCompleteThreshold: 0.9,
  autoPauseOnNote: true,
  seekStepSeconds: 10,
  dailyGoalMinutes: 30,
  showOriginalFileNames: false,
};

export function createEmptyDB(): PlaymachineDB {
  return {
    version: 1,
    courses: [],
    studyLogs: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}

export class LocalStore {
  private readonly filePath: string;
  private cache: PlaymachineDB | null = null;

  constructor(userDataDir: string) {
    this.filePath = path.join(userDataDir, 'playmachine-db.json');
  }

  getFilePath(): string {
    return this.filePath;
  }

  load(): PlaymachineDB {
    if (this.cache) return this.cache;

    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<PlaymachineDB>;
        this.cache = {
          version: 1,
          courses: Array.isArray(parsed.courses) ? parsed.courses : [],
          studyLogs: parsed.studyLogs && typeof parsed.studyLogs === 'object' ? parsed.studyLogs : {},
          settings: {
            ...DEFAULT_SETTINGS,
            ...(parsed.settings ?? {}),
          },
        };
        return this.cache;
      }
    } catch (err) {
      console.error('[store] Failed to read DB, initializing fresh state:', err);
    }

    this.cache = createEmptyDB();
    return this.cache;
  }

  save(db: PlaymachineDB): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const normalized: PlaymachineDB = {
      version: 1,
      courses: Array.isArray(db.courses) ? db.courses : [],
      studyLogs: db.studyLogs ?? {},
      settings: {
        ...DEFAULT_SETTINGS,
        ...(db.settings ?? {}),
      },
    };

    // Atomic write to avoid file corruption on unexpected shutdown
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(normalized, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.filePath);
    this.cache = normalized;
  }
}
