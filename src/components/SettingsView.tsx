import React from 'react';
import {
  Download,
  Keyboard,
  Moon,
  Sun,
  Upload,
} from 'lucide-react';
import type { AppSettings, PlaymachineDB } from '@shared/types';
import { Button } from './ui/Button';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onReplaceDB: (db: PlaymachineDB) => void;
  onToast: (msg: string, tone?: 'mint' | 'peach' | 'ink') => void;
}

const SHORTCUTS = [
  ['Space / K', 'Play or Pause video'],
  ['← / → or J / L', 'Seek backward / forward'],
  ['Shift + ← / →', 'Jump ±30 seconds'],
  ['[ / ]', 'Decrease / increase playback speed'],
  ['N', 'Snap timestamped note at current time'],
  ['B', 'Drop quick bookmark at current time'],
  ['C', 'Toggle subtitles (.srt / .vtt)'],
  ['T or ⌘\\', 'Toggle Focus / Theater mode'],
  ['Shift + N / P', 'Next / Previous lesson'],
  ['M / F / P', 'Mute / Fullscreen / Picture-in-Picture'],
  ['⌘K', 'Global Quick Jump palette'],
  ['⌘O', 'Import course or collection folder'],
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onReplaceDB,
  onToast,
}) => {
  const handleExportBackup = async () => {
    const res = await window.playmachine?.exportBackup();
    if (res?.savedPath) {
      onToast(`Backup saved to ${res.savedPath.split('/').pop()}`, 'mint');
    }
  };

  const handleImportBackup = async () => {
    try {
      const restored = await window.playmachine?.importBackup();
      if (restored) {
        onReplaceDB(restored);
        onToast(`Restored ${restored.courses.length} courses from backup`, 'mint');
      }
    } catch {
      onToast('Could not import backup JSON file', 'peach');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-6 sm:px-8">
        <div className="border-b border-line pb-5">
          <div className="font-mono text-[10px] tracking-wider text-fg-muted uppercase">
            Preferences
          </div>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-fg">
            Player &amp; LMS Settings
          </h1>
        </div>

        {/* Appearance Tone (Faddy Canvas vs Ink) */}
        <section className="border border-line bg-panel p-5">
          <h2 className="text-sm font-semibold text-fg">Appearance Theme</h2>
          <p className="mt-0.5 text-xs text-fg-muted">
            Switch between Faddy’s warm Ivory Canvas and deep Oceanic Ink dark mode.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 max-w-md">
            <button
              type="button"
              onClick={() => onUpdateSettings({ theme: 'canvas' })}
              className={`flex items-center gap-3 border p-3 text-left transition cursor-pointer ${
                settings.theme === 'canvas'
                  ? 'border-ink bg-mint-soft text-ink shadow-offset-teal'
                  : 'border-line bg-panel-head text-fg hover:border-line-strong'
              }`}
            >
              <span className="flex size-8 items-center justify-center border border-ink bg-[#fcf8eb] text-[#022435]">
                <Sun className="size-4" />
              </span>
              <div>
                <div className="text-xs font-semibold">Ivory Canvas</div>
                <div className="font-mono text-[10px] opacity-75">#FCF8EB + Mint</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onUpdateSettings({ theme: 'ink' })}
              className={`flex items-center gap-3 border p-3 text-left transition cursor-pointer ${
                settings.theme === 'ink'
                  ? 'border-mint bg-ink text-ivory shadow-offset-mint'
                  : 'border-line bg-panel-head text-fg hover:border-line-strong'
              }`}
            >
              <span className="flex size-8 items-center justify-center border border-mint/40 bg-[#022435] text-[#aaf3ce]">
                <Moon className="size-4" />
              </span>
              <div>
                <div className="text-xs font-semibold">Oceanic Ink</div>
                <div className="font-mono text-[10px] opacity-75">#022435 + Mint</div>
              </div>
            </button>
          </div>
        </section>

        {/* Playback & LMS Behavior */}
        <section className="border border-line bg-panel divide-y divide-line">
          <div className="bg-panel-head px-5 py-3">
            <h2 className="text-sm font-semibold text-fg">Playback &amp; Curriculum Behavior</h2>
          </div>

          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div>
              <div className="text-xs font-medium text-fg">Default Playback Speed</div>
              <div className="text-[11px] text-fg-muted">Applied automatically when opening lessons.</div>
            </div>
            <select
              value={settings.defaultPlaybackRate}
              onChange={(e) =>
                onUpdateSettings({ defaultPlaybackRate: parseFloat(e.target.value) })
              }
              className="h-8 border border-line bg-panel-head px-2.5 font-mono text-xs text-fg outline-none focus:border-ink"
            >
              {[0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
                <option key={r} value={r}>
                  {r}x
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div>
              <div className="text-xs font-medium text-fg">Seek Jump Step</div>
              <div className="text-[11px] text-fg-muted">Seconds skipped on ← / → or J / L keys.</div>
            </div>
            <select
              value={settings.seekStepSeconds}
              onChange={(e) =>
                onUpdateSettings({ seekStepSeconds: parseInt(e.target.value, 10) })
              }
              className="h-8 border border-line bg-panel-head px-2.5 font-mono text-xs text-fg outline-none focus:border-ink"
            >
              {[5, 10, 15, 30].map((s) => (
                <option key={s} value={s}>
                  {s} seconds
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div>
              <div className="text-xs font-medium text-fg">Auto-Complete Threshold</div>
              <div className="text-[11px] text-fg-muted">
                Mark a lesson completed automatically once watched past this percentage.
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="range"
                min={75}
                max={98}
                step={1}
                value={Math.round(settings.autoCompleteThreshold * 100)}
                onChange={(e) =>
                  onUpdateSettings({
                    autoCompleteThreshold: parseInt(e.target.value, 10) / 100,
                  })
                }
                className="w-28 accent-[#058996]"
              />
              <span className="w-10 text-right font-mono text-xs font-semibold text-fg">
                {Math.round(settings.autoCompleteThreshold * 100)}%
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div>
              <div className="text-xs font-medium text-fg">Daily Study Goal</div>
              <div className="text-[11px] text-fg-muted">Target study minutes per day for your sidebar meter.</div>
            </div>
            <select
              value={settings.dailyGoalMinutes}
              onChange={(e) =>
                onUpdateSettings({ dailyGoalMinutes: parseInt(e.target.value, 10) })
              }
              className="h-8 border border-line bg-panel-head px-2.5 font-mono text-xs text-fg outline-none focus:border-ink"
            >
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m} min / day
                </option>
              ))}
            </select>
          </div>

          {(
            [
              [
                'autoPlayNext',
                'Auto-play next lesson',
                'Show a 5-second countdown and advance automatically when a video finishes.',
              ],
              [
                'autoPauseOnNote',
                'Auto-pause when taking a note',
                'Pauses playback automatically when pressing N or clicking the note box.',
              ],
              [
                'showOriginalFileNames',
                'Show raw filenames in syllabus',
                'Display original video filenames subtly beneath auto-generated lesson titles.',
              ],
            ] as const
          ).map(([key, label, desc]) => (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3.5"
            >
              <div>
                <div className="text-xs font-medium text-fg">{label}</div>
                <div className="text-[11px] text-fg-muted">{desc}</div>
              </div>
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={(e) => onUpdateSettings({ [key]: e.target.checked })}
                className="size-4 accent-[#022435] cursor-pointer"
              />
            </label>
          ))}
        </section>

        {/* Data Backup & Portability */}
        <section className="flex flex-wrap items-center justify-between gap-4 border border-line bg-panel p-5">
          <div>
            <h2 className="text-sm font-semibold text-fg">Library Backup &amp; Restore</h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              All progress, generated titles, notes, bookmarks, and flashcards are stored locally as
              JSON.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ivory" size="sm" onClick={handleExportBackup}>
              <Download className="size-3.5" />
              Export JSON
            </Button>
            <Button variant="ghost" size="sm" onClick={handleImportBackup}>
              <Upload className="size-3.5" />
              Restore Backup
            </Button>
          </div>
        </section>

        {/* Keyboard Shortcuts Reference */}
        <section className="border border-line bg-panel">
          <div className="flex items-center gap-2 border-b border-line bg-panel-head px-5 py-3">
            <Keyboard className="size-4 text-highlight" />
            <h2 className="text-sm font-semibold text-fg">Keyboard Shortcuts</h2>
          </div>
          <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x">
            {SHORTCUTS.map(([keys, desc]) => (
              <div
                key={keys}
                className="flex items-center justify-between gap-3 px-5 py-2.5 text-xs"
              >
                <span className="text-fg-muted">{desc}</span>
                <kbd className="border border-line bg-panel-head px-2 py-0.5 font-mono text-[10px] font-semibold text-fg">
                  {keys}
                </kbd>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
