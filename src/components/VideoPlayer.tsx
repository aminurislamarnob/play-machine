import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  Bookmark,
  Check,
  FastForward,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  Rewind,
  SkipBack,
  SkipForward,
  StickyNote,
  Subtitles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { AppSettings, Lesson } from '@shared/types';
import { formatDuration } from '@/lib/format';
import { Button } from './ui/Button';

export interface VideoPlayerHandle {
  seekTo: (seconds: number, autoPlay?: boolean) => void;
  pause: () => void;
  play: () => void;
  togglePlay: () => void;
  getCurrentTime: () => number;
}

interface VideoPlayerProps {
  lesson: Lesson;
  settings: AppSettings;
  hasPrev: boolean;
  hasNext: boolean;
  nextLessonTitle?: string;
  initialSeekSeconds?: number | null;
  onInitialSeekConsumed?: () => void;
  onProgress: (watchedSeconds: number, duration: number, deltaWatched: number) => void;
  onTimeUpdate?: (seconds: number) => void;
  onPrevLesson: () => void;
  onNextLesson: () => void;
  onQuickBookmark: (timestamp: number) => void;
  onQuickNote: (timestamp: number) => void;
  onToggleFocus: () => void;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5];

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  (
    {
      lesson,
      settings,
      hasPrev,
      hasNext,
      nextLessonTitle,
      initialSeekSeconds,
      onInitialSeekConsumed,
      onProgress,
      onTimeUpdate,
      onPrevLesson,
      onNextLesson,
      onQuickBookmark,
      onQuickNote,
      onToggleFocus,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(lesson.duration || 0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(settings.defaultPlaybackRate || 1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [controlsHovered, setControlsHovered] = useState(false);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [showSubMenu, setShowSubMenu] = useState(false);
    const [activeSubId, setActiveSubId] = useState<string | null>(null);
    const [subTrackUrl, setSubTrackUrl] = useState<string | null>(null);
    const [loopA, setLoopA] = useState<number | null>(null);
    const [loopB, setLoopB] = useState<number | null>(null);
    const [mediaError, setMediaError] = useState<string | null>(null);
    const [hudText, setHudText] = useState<string | null>(null);
    const [nextCountdown, setNextCountdown] = useState<number | null>(null);

    const lastSavedTimeRef = useRef(0);
    const accWatchRef = useRef(0);
    const lastTickWallRef = useRef<number | null>(null);
    const hudTimerRef = useRef<number | null>(null);
    const idleTimerRef = useRef<number | null>(null);

    const mediaSrc = window.playmachine
      ? window.playmachine.getMediaUrl(lesson.filePath)
      : '';

    const flashHud = useCallback((text: string) => {
      setHudText(text);
      if (hudTimerRef.current) window.clearTimeout(hudTimerRef.current);
      hudTimerRef.current = window.setTimeout(() => setHudText(null), 950);
    }, []);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number, autoPlay = true) => {
        const video = videoRef.current;
        if (!video) return;
        const clamped = Math.max(0, Math.min(seconds, video.duration || seconds));
        video.currentTime = clamped;
        setCurrentTime(clamped);
        if (autoPlay) {
          void video.play().catch(() => {});
        }
      },
      pause: () => videoRef.current?.pause(),
      play: () => void videoRef.current?.play().catch(() => {}),
      togglePlay: () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) void video.play().catch(() => {});
        else video.pause();
      },
      getCurrentTime: () => videoRef.current?.currentTime ?? currentTime,
    }));

    // Reset state when switching lessons
    useEffect(() => {
      setMediaError(null);
      setNextCountdown(null);
      setLoopA(null);
      setLoopB(null);
      setDuration(lesson.duration || 0);
      setCurrentTime(0);
      accWatchRef.current = 0;
      lastTickWallRef.current = null;
      lastSavedTimeRef.current = 0;
      setShowSpeedMenu(false);
      setShowSubMenu(false);

      // Auto-select first subtitle if available
      if (lesson.subtitles.length > 0) {
        setActiveSubId(lesson.subtitles[0].id);
      } else {
        setActiveSubId(null);
      }
    }, [lesson.id]);

    // Load active subtitle track (converting SRT -> WebVTT in main process)
    useEffect(() => {
      let revokedUrl: string | null = null;
      let cancelled = false;

      const loadSub = async () => {
        if (!activeSubId || !window.playmachine) {
          setSubTrackUrl(null);
          return;
        }
        const track = lesson.subtitles.find((s) => s.id === activeSubId);
        if (!track) {
          setSubTrackUrl(null);
          return;
        }
        try {
          const vtt = await window.playmachine.getSubtitleVtt(track.filePath);
          if (cancelled || !vtt) return;
          const blob = new Blob([vtt], { type: 'text/vtt' });
          revokedUrl = URL.createObjectURL(blob);
          setSubTrackUrl(revokedUrl);
        } catch {
          setSubTrackUrl(null);
        }
      };

      void loadSub();
      return () => {
        cancelled = true;
        if (revokedUrl) URL.revokeObjectURL(revokedUrl);
      };
    }, [activeSubId, lesson.subtitles]);

    // Ensure HTML5 textTracks show when subTrackUrl changes
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      const syncTracks = () => {
        for (let i = 0; i < video.textTracks.length; i++) {
          video.textTracks[i].mode = activeSubId && subTrackUrl ? 'showing' : 'hidden';
        }
      };
      syncTracks();
      const timer = window.setTimeout(syncTracks, 120);
      return () => window.clearTimeout(timer);
    }, [activeSubId, subTrackUrl, lesson.id]);

    // Apply playback rate
    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.playbackRate = playbackRate;
      }
    }, [playbackRate, lesson.id]);

    // Track fullscreen change (including webkit fallback)
    useEffect(() => {
      const onFsChange = () => {
        const active = Boolean(
          document.fullscreenElement ||
            (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement,
        );
        setIsFullscreen(active);
        setControlsVisible(true);
      };
      document.addEventListener('fullscreenchange', onFsChange);
      document.addEventListener('webkitfullscreenchange', onFsChange);
      return () => {
        document.removeEventListener('fullscreenchange', onFsChange);
        document.removeEventListener('webkitfullscreenchange', onFsChange);
      };
    }, []);

    // Auto-hide controls in fullscreen after mouse inactivity while playing
    const bumpFullscreenControls = useCallback(() => {
      setControlsVisible(true);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      if (isFullscreen && playing && !controlsHovered && !showSpeedMenu && !showSubMenu) {
        idleTimerRef.current = window.setTimeout(() => {
          setControlsVisible(false);
        }, 2400);
      }
    }, [controlsHovered, isFullscreen, playing, showSpeedMenu, showSubMenu]);

    useEffect(() => {
      if (!isFullscreen || !playing || controlsHovered || showSpeedMenu || showSubMenu) {
        setControlsVisible(true);
        if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
        return;
      }
      idleTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2400);
      return () => {
        if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      };
    }, [controlsHovered, isFullscreen, playing, showSpeedMenu, showSubMenu]);

    // Auto-next lesson countdown
    useEffect(() => {
      if (nextCountdown === null) return;
      if (nextCountdown <= 0) {
        setNextCountdown(null);
        onNextLesson();
        return;
      }
      const id = window.setTimeout(() => setNextCountdown((n) => (n !== null ? n - 1 : null)), 1000);
      return () => window.clearTimeout(id);
    }, [nextCountdown, onNextLesson]);

    const flushProgress = useCallback(
      (forceTime?: number, forceDur?: number) => {
        const video = videoRef.current;
        const t = forceTime ?? video?.currentTime ?? 0;
        const d = forceDur ?? (video?.duration && Number.isFinite(video.duration) ? video.duration : duration);
        const delta = Math.round(accWatchRef.current);
        accWatchRef.current = 0;
        lastSavedTimeRef.current = t;
        onProgress(t, d, delta);
      },
      [duration, onProgress],
    );

    const handleLoadedMetadata = () => {
      const video = videoRef.current;
      if (!video) return;
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      setDuration(d);
      video.playbackRate = playbackRate;

      // Jump to explicit external seek (e.g. from Notes Hub or Command Palette)
      if (initialSeekSeconds !== null && initialSeekSeconds !== undefined) {
        video.currentTime = Math.min(initialSeekSeconds, Math.max(0, d - 1));
        setCurrentTime(video.currentTime);
        onInitialSeekConsumed?.();
      } else if (
        lesson.watchedSeconds > 3 &&
        (!d || lesson.watchedSeconds < d - 8)
      ) {
        // Resume where learner left off
        video.currentTime = lesson.watchedSeconds;
        setCurrentTime(lesson.watchedSeconds);
      }

      if (d > 0 && Math.round(d) !== lesson.duration) {
        onProgress(video.currentTime, d, 0);
      }
    };

    const handleTimeUpdate = () => {
      const video = videoRef.current;
      if (!video) return;
      const t = video.currentTime;
      setCurrentTime(t);
      onTimeUpdate?.(t);

      // A-B Segment loop
      if (loopA !== null && loopB !== null && loopB > loopA && t >= loopB) {
        video.currentTime = loopA;
        return;
      }

      // Accumulate real elapsed study time while playing
      if (!video.paused) {
        const now = Date.now();
        if (lastTickWallRef.current !== null) {
          const dt = (now - lastTickWallRef.current) / 1000;
          if (dt > 0 && dt < 3) {
            accWatchRef.current += dt;
          }
        }
        lastTickWallRef.current = now;
      }

      if (accWatchRef.current >= 4 || Math.abs(t - lastSavedTimeRef.current) >= 10) {
        flushProgress(t, video.duration);
      }
    };

    const handlePlay = () => {
      setPlaying(true);
      setNextCountdown(null);
      lastTickWallRef.current = Date.now();
    };

    const handlePause = () => {
      setPlaying(false);
      lastTickWallRef.current = null;
      flushProgress();
    };

    const handleEnded = () => {
      setPlaying(false);
      lastTickWallRef.current = null;
      const video = videoRef.current;
      const d = video?.duration || duration;
      flushProgress(d, d);
      if (settings.autoPlayNext && hasNext) {
        setNextCountdown(5);
      }
    };

    const togglePlay = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        void video.play().catch(() => {});
      } else {
        video.pause();
      }
    }, []);

    const seekBy = useCallback(
      (delta: number) => {
        const video = videoRef.current;
        if (!video) return;
        const target = Math.max(0, Math.min(video.duration || duration, video.currentTime + delta));
        video.currentTime = target;
        setCurrentTime(target);
        flashHud(`${delta > 0 ? '+' : ''}${delta}s`);
      },
      [duration, flashHud],
    );

    const triggerQuickNote = useCallback(
      (timestamp: number) => {
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => {});
        }
        onQuickNote(timestamp);
      },
      [onQuickNote],
    );

    const toggleFullscreen = useCallback(() => {
      if (!containerRef.current) return;
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void containerRef.current.requestFullscreen();
      }
    }, []);

    const togglePiP = useCallback(async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled) {
          await video.requestPictureInPicture();
        }
      } catch {
        // Ignore if PiP unsupported for codec
      }
    }, []);

    const cycleAbLoop = () => {
      if (loopA === null) {
        setLoopA(currentTime);
        flashHud(`Loop A set @ ${formatDuration(currentTime)}`);
      } else if (loopB === null) {
        if (currentTime > loopA + 1) {
          setLoopB(currentTime);
          flashHud(`Looping ${formatDuration(loopA)} → ${formatDuration(currentTime)}`);
        } else {
          setLoopA(null);
          flashHud('Loop cleared');
        }
      } else {
        setLoopA(null);
        setLoopB(null);
        flashHud('Loop cleared');
      }
    };

    // Global Classroom Keyboard Shortcuts
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable)
        ) {
          return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        const step = settings.seekStepSeconds || 10;

        switch (e.key) {
          case ' ':
          case 'k':
          case 'K':
            e.preventDefault();
            togglePlay();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            seekBy(e.shiftKey ? -30 : -step);
            break;
          case 'ArrowRight':
            e.preventDefault();
            seekBy(e.shiftKey ? 30 : step);
            break;
          case 'j':
          case 'J':
            e.preventDefault();
            seekBy(-step);
            break;
          case 'l':
          case 'L':
            e.preventDefault();
            seekBy(step);
            break;
          case '[': {
            e.preventDefault();
            const idx = PLAYBACK_RATES.indexOf(playbackRate);
            const next = PLAYBACK_RATES[Math.max(0, idx - 1)];
            setPlaybackRate(next);
            flashHud(`Speed ${next}x`);
            break;
          }
          case ']': {
            e.preventDefault();
            const idx = PLAYBACK_RATES.indexOf(playbackRate);
            const next = PLAYBACK_RATES[Math.min(PLAYBACK_RATES.length - 1, idx + 1)];
            setPlaybackRate(next);
            flashHud(`Speed ${next}x`);
            break;
          }
          case 'm':
          case 'M':
            e.preventDefault();
            setMuted((m) => {
              const next = !m;
              if (videoRef.current) videoRef.current.muted = next;
              flashHud(next ? 'Muted' : 'Unmuted');
              return next;
            });
            break;
          case 'f':
          case 'F':
            e.preventDefault();
            toggleFullscreen();
            break;
          case 'p':
            e.preventDefault();
            void togglePiP();
            break;
          case 'P':
            if (e.shiftKey && hasPrev) {
              e.preventDefault();
              onPrevLesson();
            }
            break;
          case 'N':
            if (e.shiftKey && hasNext) {
              e.preventDefault();
              onNextLesson();
            }
            break;
          case 'n':
            e.preventDefault();
            triggerQuickNote(videoRef.current?.currentTime ?? currentTime);
            break;
          case 'b':
          case 'B':
            e.preventDefault();
            onQuickBookmark(videoRef.current?.currentTime ?? currentTime);
            flashHud(`Bookmarked @ ${formatDuration(videoRef.current?.currentTime ?? currentTime)}`);
            break;
          case 'c':
          case 'C':
            if (lesson.subtitles.length > 0) {
              e.preventDefault();
              setActiveSubId((curr) => {
                const next = curr ? null : lesson.subtitles[0].id;
                flashHud(next ? 'Captions On' : 'Captions Off');
                return next;
              });
            }
            break;
          case 't':
          case 'T':
            e.preventDefault();
            onToggleFocus();
            break;
        }
      };

      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [
      currentTime,
      flashHud,
      hasNext,
      hasPrev,
      lesson.subtitles,
      onNextLesson,
      onPrevLesson,
      onQuickBookmark,
      onToggleFocus,
      playbackRate,
      seekBy,
      settings.seekStepSeconds,
      toggleFullscreen,
      togglePiP,
      togglePlay,
      triggerQuickNote,
    ]);

    const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
    const hideChromeInFullscreen = isFullscreen && !controlsVisible;

    return (
      <div
        ref={containerRef}
        onMouseMove={isFullscreen ? bumpFullscreenControls : undefined}
        className={`video-player-shell group/player relative flex flex-col bg-ink-950 select-none ${
          isFullscreen
            ? `h-screen w-screen border-0 bg-[#01131d] ${hideChromeInFullscreen ? 'cursor-none' : ''}`
            : 'border border-ink'
        }`}
        onClick={() => {
          setShowSpeedMenu(false);
          setShowSubMenu(false);
        }}
      >
        {/* Video Viewport */}
        <div
          className={`video-player-viewport relative w-full overflow-hidden bg-[#01131d] ${
            isFullscreen ? 'flex-1 min-h-0 h-full' : 'aspect-video max-h-[62vh]'
          }`}
        >
          <video
            key={lesson.id}
            ref={videoRef}
            src={mediaSrc}
            playsInline
            preload="metadata"
            onClick={togglePlay}
            onDoubleClick={toggleFullscreen}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onError={() =>
              setMediaError(
                'This video format could not be decoded natively by Chromium. Try MP4/WebM/MOV (H.264/HEVC) or open in QuickTime/VLC.',
              )
            }
            className={`h-full w-full object-contain ${
              hideChromeInFullscreen ? 'cursor-none' : 'cursor-pointer'
            }`}
          >
            {subTrackUrl && (
              <track
                kind="subtitles"
                src={subTrackUrl}
                srcLang="en"
                label="Subtitles"
                default
              />
            )}
          </video>

          {/* Subtle Top Lesson Title Bar in Fullscreen */}
          {isFullscreen && (
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-ink-950/90 via-ink-950/45 to-transparent px-6 pt-5 pb-10 transition-opacity duration-200 ${
                controlsVisible ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="border border-mint/40 bg-mint px-2 py-0.5 font-mono text-[11px] font-semibold text-ink">
                  {lesson.displayIndex}
                </span>
                <span className="truncate text-sm font-medium text-ivory drop-shadow">
                  {lesson.title}
                </span>
              </div>
              <span className="hidden font-mono text-[11px] text-ivory/65 sm:inline">
                ESC or F to exit fullscreen
              </span>
            </div>
          )}

          {/* Center Play Button Overlay when paused */}
          {!playing && !mediaError && nextCountdown === null && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label="Play video"
              className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center border-2 border-ink bg-mint text-ink shadow-[4px_4px_0_0_var(--color-teal)] transition hover:scale-105 cursor-pointer"
            >
              <Play className="ml-1 size-7 fill-current" strokeWidth={1.8} />
            </button>
          )}

          {/* Transient HUD pill */}
          {hudText && (
            <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 border border-mint/40 bg-ink/90 px-3 py-1 font-mono text-xs font-medium text-mint">
              {hudText}
            </div>
          )}

          {/* A-B Loop active indicator */}
          {loopA !== null && (
            <div className="absolute top-3 left-3 flex items-center gap-2 border border-mint/40 bg-ink/90 px-2.5 py-1 font-mono text-[11px] text-mint">
              <Repeat className="size-3" />
              <span>
                A: {formatDuration(loopA)}
                {loopB !== null ? ` → B: ${formatDuration(loopB)}` : ' (click Repeat to set B)'}
              </span>
            </div>
          )}

          {/* Media decode error overlay */}
          {mediaError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/95 p-6 text-center text-ivory">
              <AlertCircle className="size-9 text-peach" strokeWidth={1.6} />
              <div className="max-w-md">
                <h3 className="text-sm font-semibold">Unable to play video inline</h3>
                <p className="mt-1 text-xs text-ivory/75">{mediaError}</p>
              </div>
              <Button
                variant="mint"
                size="sm"
                onClick={() => void window.playmachine?.openPath(lesson.filePath)}
              >
                Open with Default macOS Player
              </Button>
            </div>
          )}

          {/* Auto-play Next Lesson Overlay */}
          {nextCountdown !== null && hasNext && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/85 p-6 backdrop-blur-[2px]">
              <div className="w-full max-w-sm border border-mint bg-ink p-5 text-ivory shadow-offset-mint">
                <div className="font-mono text-[10px] tracking-wider text-mint uppercase">
                  Up Next in {nextCountdown}s
                </div>
                <div className="mt-1.5 text-base font-semibold tracking-tight">
                  {nextLessonTitle || 'Next Lesson'}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    variant="mint"
                    size="sm"
                    onClick={() => {
                      setNextCountdown(null);
                      onNextLesson();
                    }}
                  >
                    <Play className="size-3.5 fill-current" />
                    Play Now
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="border-ivory/25 text-ivory hover:bg-ink-800 hover:text-ivory"
                    onClick={() => setNextCountdown(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Custom Faddy Ink Transport Control Deck */}
        <div
          onMouseEnter={() => setControlsHovered(true)}
          onMouseLeave={() => setControlsHovered(false)}
          className={`border-t border-ink-800 px-3.5 pt-2.5 pb-2.5 text-ivory transition-all duration-200 ${
            isFullscreen
              ? `absolute inset-x-0 bottom-0 z-20 bg-ink/90 px-5 pb-4 backdrop-blur-sm ${
                  controlsVisible
                    ? 'translate-y-0 opacity-100'
                    : 'pointer-events-none translate-y-2 opacity-0'
                }`
              : 'bg-ink'
          }`}
        >
          {/* Interactive Timeline Scrubber with Note & Bookmark Markers */}
          <div
            className="group/scrub relative mb-2.5 flex h-4 cursor-pointer items-center"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const target = ratio * duration;
              if (videoRef.current && duration > 0) {
                videoRef.current.currentTime = target;
                setCurrentTime(target);
              }
            }}
          >
            <div className="relative h-1.5 w-full bg-ink-800 transition-all group-hover/scrub:h-2">
              {/* Loop range highlight */}
              {loopA !== null && loopB !== null && duration > 0 && (
                <div
                  className="absolute top-0 bottom-0 bg-peach/55"
                  style={{
                    left: `${(loopA / duration) * 100}%`,
                    width: `${((loopB - loopA) / duration) * 100}%`,
                  }}
                />
              )}

              {/* Played fill */}
              <div
                className="h-full bg-mint transition-[width] duration-75"
                style={{ width: `${progressPct}%` }}
              />

              {/* Note ticks (teal/mint) */}
              {duration > 0 &&
                lesson.notes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    title={`Note @ ${formatDuration(note.timestamp)}: ${note.content}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoRef.current) {
                        videoRef.current.currentTime = note.timestamp;
                        setCurrentTime(note.timestamp);
                      }
                    }}
                    style={{ left: `${Math.min(99.5, (note.timestamp / duration) * 100)}%` }}
                    className="absolute top-1/2 z-10 h-3 w-1 -translate-x-1/2 -translate-y-1/2 bg-teal hover:scale-y-125 cursor-pointer"
                  />
                ))}

              {/* Bookmark ticks (peach) */}
              {duration > 0 &&
                lesson.bookmarks.map((bm) => (
                  <button
                    key={bm.id}
                    type="button"
                    title={`Bookmark @ ${formatDuration(bm.timestamp)}: ${bm.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoRef.current) {
                        videoRef.current.currentTime = bm.timestamp;
                        setCurrentTime(bm.timestamp);
                      }
                    }}
                    style={{ left: `${Math.min(99.5, (bm.timestamp / duration) * 100)}%` }}
                    className="absolute top-1/2 z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-ink bg-peach hover:scale-125 cursor-pointer"
                  />
                ))}

              {/* Playhead thumb */}
              <div
                className="pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 border border-ink bg-ivory shadow"
                style={{ left: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Left controls: Playback + Seek + Time */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={onPrevLesson}
                title="Previous lesson (Shift+P)"
                className="inline-flex size-7 items-center justify-center text-ivory/80 hover:bg-ink-800 hover:text-mint disabled:opacity-30 cursor-pointer"
              >
                <SkipBack className="size-3.5" strokeWidth={1.7} />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                title={playing ? 'Pause (Space)' : 'Play (Space)'}
                className="inline-flex size-8 items-center justify-center border border-mint/40 bg-mint text-ink hover:bg-mint-soft cursor-pointer"
              >
                {playing ? (
                  <Pause className="size-4 fill-current" />
                ) : (
                  <Play className="ml-0.5 size-4 fill-current" />
                )}
              </button>

              <button
                type="button"
                disabled={!hasNext}
                onClick={onNextLesson}
                title="Next lesson (Shift+N)"
                className="inline-flex size-7 items-center justify-center text-ivory/80 hover:bg-ink-800 hover:text-mint disabled:opacity-30 cursor-pointer"
              >
                <SkipForward className="size-3.5" strokeWidth={1.7} />
              </button>

              <span className="mx-0.5 h-4 w-px bg-ink-800" />

              <button
                type="button"
                onClick={() => seekBy(-(settings.seekStepSeconds || 10))}
                title={`Rewind ${settings.seekStepSeconds}s (J / ←)`}
                className="inline-flex size-7 items-center justify-center text-ivory/80 hover:bg-ink-800 hover:text-mint cursor-pointer"
              >
                <Rewind className="size-3.5" strokeWidth={1.7} />
              </button>

              <button
                type="button"
                onClick={() => seekBy(settings.seekStepSeconds || 10)}
                title={`Forward ${settings.seekStepSeconds}s (L / →)`}
                className="inline-flex size-7 items-center justify-center text-ivory/80 hover:bg-ink-800 hover:text-mint cursor-pointer"
              >
                <FastForward className="size-3.5" strokeWidth={1.7} />
              </button>

              {/* Volume */}
              <div className="ml-1 hidden items-center gap-1.5 sm:flex">
                <button
                  type="button"
                  onClick={() => {
                    const next = !muted;
                    setMuted(next);
                    if (videoRef.current) videoRef.current.muted = next;
                  }}
                  title="Mute (M)"
                  className="inline-flex size-7 items-center justify-center text-ivory/80 hover:bg-ink-800 hover:text-mint cursor-pointer"
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="size-3.5 text-peach" />
                  ) : (
                    <Volume2 className="size-3.5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setVolume(val);
                    setMuted(val === 0);
                    if (videoRef.current) {
                      videoRef.current.volume = val;
                      videoRef.current.muted = val === 0;
                    }
                  }}
                  className="h-1 w-16 accent-[#aaf3ce] cursor-pointer"
                />
              </div>

              <span className="ml-2 font-mono text-[11px] tabular-nums text-ivory/85">
                {formatDuration(currentTime)}{' '}
                <span className="text-ivory/45">/ {formatDuration(duration)}</span>
              </span>
            </div>

            {/* Right controls: LMS Quick Capture, A-B Loop, Speed, CC, PiP, Fullscreen */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => triggerQuickNote(currentTime)}
                title="Add timestamped note (N)"
                className="inline-flex h-7 items-center gap-1 border border-ink-800 bg-ink-800/70 px-2 font-mono text-[11px] text-mint hover:border-mint/50 hover:bg-ink-800 cursor-pointer"
              >
                <StickyNote className="size-3" />
                <span className="hidden md:inline">Note</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onQuickBookmark(currentTime);
                  flashHud(`Bookmarked @ ${formatDuration(currentTime)}`);
                }}
                title="Bookmark timestamp (B)"
                className="inline-flex h-7 items-center gap-1 border border-ink-800 bg-ink-800/70 px-2 font-mono text-[11px] text-peach hover:border-peach/50 hover:bg-ink-800 cursor-pointer"
              >
                <Bookmark className="size-3" />
                <span className="hidden md:inline">Pin</span>
              </button>

              <button
                type="button"
                onClick={cycleAbLoop}
                title="A-B Segment Loop (click once for A, again for B, third time to clear)"
                className={`inline-flex h-7 items-center gap-1 border px-2 font-mono text-[11px] cursor-pointer ${
                  loopA !== null
                    ? 'border-peach bg-peach text-ink'
                    : 'border-transparent text-ivory/75 hover:bg-ink-800 hover:text-ivory'
                }`}
              >
                <Repeat className="size-3" />
                <span className="hidden lg:inline">
                  {loopA === null ? 'A-B' : loopB === null ? 'Set B' : 'Loop'}
                </span>
              </button>

              {/* Playback speed popover */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => {
                    setShowSpeedMenu((s) => !s);
                    setShowSubMenu(false);
                  }}
                  title="Playback speed ([ / ])"
                  className="inline-flex h-7 min-w-[44px] items-center justify-center border border-ink-800 px-1.5 font-mono text-[11px] text-ivory hover:border-mint/40 hover:text-mint cursor-pointer"
                >
                  {playbackRate}x
                </button>
                {showSpeedMenu && (
                  <div className="absolute right-0 bottom-9 z-30 w-24 border border-mint/40 bg-ink py-1 shadow-offset-mint">
                    {PLAYBACK_RATES.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => {
                          setPlaybackRate(rate);
                          setShowSpeedMenu(false);
                        }}
                        className={`flex w-full items-center justify-between px-2.5 py-1 font-mono text-[11px] cursor-pointer ${
                          playbackRate === rate
                            ? 'bg-mint font-semibold text-ink'
                            : 'text-ivory hover:bg-ink-800'
                        }`}
                      >
                        <span>{rate}x</span>
                        {playbackRate === rate && <Check className="size-3" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Subtitles menu */}
              {lesson.subtitles.length > 0 && (
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSubMenu((s) => !s);
                      setShowSpeedMenu(false);
                    }}
                    title="Subtitles (C)"
                    className={`inline-flex size-7 items-center justify-center border cursor-pointer ${
                      activeSubId
                        ? 'border-mint bg-mint text-ink'
                        : 'border-transparent text-ivory/75 hover:bg-ink-800 hover:text-ivory'
                    }`}
                  >
                    <Subtitles className="size-3.5" />
                  </button>
                  {showSubMenu && (
                    <div className="absolute right-0 bottom-9 z-30 w-40 border border-mint/40 bg-ink py-1 shadow-offset-mint">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSubId(null);
                          setShowSubMenu(false);
                        }}
                        className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[11px] cursor-pointer ${
                          activeSubId === null
                            ? 'bg-mint font-semibold text-ink'
                            : 'text-ivory hover:bg-ink-800'
                        }`}
                      >
                        <span>Off</span>
                        {activeSubId === null && <Check className="size-3" />}
                      </button>
                      {lesson.subtitles.map((track) => (
                        <button
                          key={track.id}
                          type="button"
                          onClick={() => {
                            setActiveSubId(track.id);
                            setShowSubMenu(false);
                          }}
                          className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[11px] cursor-pointer ${
                            activeSubId === track.id
                              ? 'bg-mint font-semibold text-ink'
                              : 'text-ivory hover:bg-ink-800'
                          }`}
                        >
                          <span className="truncate">{track.label}</span>
                          {activeSubId === track.id && <Check className="size-3" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => void togglePiP()}
                title="Picture in Picture (P)"
                className="inline-flex size-7 items-center justify-center text-ivory/75 hover:bg-ink-800 hover:text-mint cursor-pointer"
              >
                <PictureInPicture2 className="size-3.5" strokeWidth={1.6} />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  toggleFullscreen();
                }}
                title="Fullscreen (F)"
                className="inline-flex size-7 items-center justify-center text-ivory/75 hover:bg-ink-800 hover:text-mint focus:outline-none focus-visible:ring-1 focus-visible:ring-mint cursor-pointer"
              >
                {isFullscreen ? (
                  <Minimize className="size-3.5" strokeWidth={1.7} />
                ) : (
                  <Maximize className="size-3.5" strokeWidth={1.7} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

VideoPlayer.displayName = 'VideoPlayer';
