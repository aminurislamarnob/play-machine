import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  StickyNote,
  Target,
  Trash2,
} from 'lucide-react';
import type { Course, Lesson, LessonNote, Section } from '@shared/types';
import { Button } from './ui/Button';
import { formatDuration, formatFileSize } from '@/lib/format';

export type WorkspaceTab = 'overview' | 'notes' | 'bookmarks' | 'resources' | 'flashcards';

interface LessonWorkspaceProps {
  course: Course;
  section: Section;
  lesson: Lesson;
  activeTab: WorkspaceTab;
  currentPlaybackSeconds: number;
  noteFocusSignal: number;
  autoPauseOnNote: boolean;
  onChangeTab: (tab: WorkspaceTab) => void;
  onSeekTo: (seconds: number) => void;
  onPauseVideo: () => void;
  onToggleComplete: () => void;
  onRenameLesson: (newTitle: string) => void;
  onAddNote: (timestamp: number, content: string, tag?: LessonNote['tag']) => void;
  onDeleteNote: (noteId: string) => void;
  onAddBookmark: (timestamp: number, label: string) => void;
  onDeleteBookmark: (bookmarkId: string) => void;
  onAddFlashcard: (question: string, answer: string) => void;
  onToggleFlashcardMastered: (cardId: string) => void;
  onDeleteFlashcard: (cardId: string) => void;
  onAddGoal: (text: string) => void;
  onToggleGoal: (goalId: string) => void;
  onDeleteGoal: (goalId: string) => void;
  onUpdateDescription: (description: string) => void;
  onExportNotes: () => void;
}

const NOTE_TAGS: Array<{ id: LessonNote['tag']; label: string; style: string }> = [
  { id: 'concept', label: 'Concept', style: 'bg-mint-soft text-ink border-ink/25' },
  { id: 'code', label: 'Code', style: 'bg-teal/25 text-fg border-teal/50' },
  { id: 'key', label: 'Key Insight', style: 'bg-peach/35 text-ink border-peach' },
  { id: 'todo', label: 'Follow-up', style: 'bg-panel-head text-fg border-line-strong' },
];

export const LessonWorkspace: React.FC<LessonWorkspaceProps> = ({
  course,
  section,
  lesson,
  activeTab,
  currentPlaybackSeconds,
  noteFocusSignal,
  autoPauseOnNote,
  onChangeTab,
  onSeekTo,
  onPauseVideo,
  onToggleComplete,
  onRenameLesson,
  onAddNote,
  onDeleteNote,
  onAddBookmark,
  onDeleteBookmark,
  onAddFlashcard,
  onToggleFlashcardMastered,
  onDeleteFlashcard,
  onAddGoal,
  onToggleGoal,
  onDeleteGoal,
  onUpdateDescription,
  onExportNotes,
}) => {
  const [noteInput, setNoteInput] = useState('');
  const [noteTag, setNoteTag] = useState<LessonNote['tag']>('concept');
  const [pinnedTime, setPinnedTime] = useState<number | null>(null);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [cardQ, setCardQ] = useState('');
  const [cardA, setCardA] = useState('');
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [goalInput, setGoalInput] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(lesson.title);
  const [descDraft, setDescDraft] = useState(course.description);

  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTitleDraft(lesson.title);
    setEditingTitle(false);
    setFlippedCards({});
  }, [lesson.id, lesson.title]);

  useEffect(() => {
    setDescDraft(course.description);
  }, [course.id, course.description]);

  // Focus note textarea when triggered by 'N' shortcut or player button
  useEffect(() => {
    if (noteFocusSignal > 0) {
      setPinnedTime(Math.floor(currentPlaybackSeconds));
      if (autoPauseOnNote) onPauseVideo();
      setTimeout(() => noteInputRef.current?.focus(), 30);
    }
  }, [noteFocusSignal]);

  const allResources = [...section.resources, ...course.resources];

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    const stamp = pinnedTime ?? Math.floor(currentPlaybackSeconds);
    onAddNote(stamp, noteInput, noteTag);
    setNoteInput('');
    setPinnedTime(null);
  };

  const handleCreateBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    onAddBookmark(Math.floor(currentPlaybackSeconds), bookmarkLabel || 'Key moment');
    setBookmarkLabel('');
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardQ.trim() || !cardA.trim()) return;
    onAddFlashcard(cardQ, cardA);
    setCardQ('');
    setCardA('');
  };

  const tabs: Array<{
    id: WorkspaceTab;
    label: string;
    count?: number;
    icon: React.ReactNode;
  }> = [
    { id: 'overview', label: 'Overview', icon: <Layers className="size-3.5" /> },
    {
      id: 'notes',
      label: 'Notes',
      count: lesson.notes.length,
      icon: <StickyNote className="size-3.5" />,
    },
    {
      id: 'bookmarks',
      label: 'Bookmarks',
      count: lesson.bookmarks.length,
      icon: <Bookmark className="size-3.5" />,
    },
    {
      id: 'resources',
      label: 'Resources',
      count: allResources.length,
      icon: <FileText className="size-3.5" />,
    },
    {
      id: 'flashcards',
      label: 'Review Cards',
      count: lesson.flashcards.length,
      icon: <Brain className="size-3.5" />,
    },
  ];

  return (
    <div className="mt-4 border border-line bg-panel">
      {/* Lesson Title Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel-head px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-mono text-[11px] text-fg-muted">
            <span className="border border-ink/20 bg-mint-soft px-1.5 py-0.5 font-semibold text-ink">
              LESSON {lesson.displayIndex}
            </span>
            <span className="truncate">{section.title}</span>
          </div>

          {editingTitle ? (
            <div className="mt-1.5 flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onRenameLesson(titleDraft);
                    setEditingTitle(false);
                  }
                  if (e.key === 'Escape') {
                    setTitleDraft(lesson.title);
                    setEditingTitle(false);
                  }
                }}
                className="flex-1 border border-ink bg-panel px-2.5 py-1 text-base font-semibold text-fg outline-none"
              />
              <Button
                variant="ink"
                size="xs"
                onClick={() => {
                  onRenameLesson(titleDraft);
                  setEditingTitle(false);
                }}
              >
                Save
              </Button>
              {lesson.title !== lesson.generatedTitle && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    onRenameLesson(lesson.generatedTitle);
                    setEditingTitle(false);
                  }}
                >
                  <RotateCcw className="size-3" />
                  Reset
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold tracking-tight text-fg">
                {lesson.title}
              </h1>
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                title="Edit lesson title"
                className="text-fg-muted hover:text-fg cursor-pointer"
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant={lesson.completed ? 'mint' : 'ivory'}
            size="sm"
            onClick={onToggleComplete}
          >
            <CheckCircle2 className="size-3.5" strokeWidth={1.8} />
            <span>{lesson.completed ? 'Completed' : 'Mark Complete'}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void window.playmachine?.revealInFinder(lesson.filePath)}
            title="Reveal video file in macOS Finder"
          >
            <FolderOpen className="size-3.5" />
            <span className="hidden sm:inline">Finder</span>
          </Button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex overflow-x-auto border-b border-line bg-panel px-3">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                isActive ? 'text-fg' : 'text-fg-muted hover:text-fg'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`px-1.5 py-0.5 font-mono text-[10px] leading-none ${
                    isActive ? 'bg-mint text-ink' : 'bg-panel-head text-fg-muted'
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {isActive && (
                <span className="absolute right-0 bottom-0 left-0 h-[2px] bg-accent" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="p-5">
        {activeTab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: File & Title Provenance + Course Notes */}
            <div className="space-y-4">
              <div className="border border-line bg-panel-head/60 p-3.5">
                <div className="font-mono text-[10px] tracking-wider text-fg-muted uppercase">
                  Lesson File Metadata
                </div>
                <dl className="mt-2 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="shrink-0 text-fg-muted">Original file</dt>
                    <dd className="truncate font-mono text-[11px] text-fg">
                      {lesson.originalFileName}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="shrink-0 text-fg-muted">Generated title</dt>
                    <dd className="truncate font-medium text-fg">{lesson.generatedTitle}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="shrink-0 text-fg-muted">Size / Subtitles</dt>
                    <dd className="font-mono text-[11px] text-fg">
                      {formatFileSize(lesson.fileSize)} · {lesson.subtitles.length} track(s)
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-[10px] tracking-wider text-fg-muted uppercase">
                  Course Overview / Syllabus Summary
                </label>
                <textarea
                  rows={4}
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  onBlur={() => onUpdateDescription(descDraft)}
                  placeholder="Write your high-level course takeaways, instructor info, or repo links…"
                  className="w-full border border-line bg-panel-head/40 p-3 text-xs leading-relaxed text-fg placeholder:text-fg-muted outline-none focus:border-ink"
                />
              </div>
            </div>

            {/* Right: Course Learning Goals Checklist */}
            <div className="border border-line bg-panel-head/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-fg-muted uppercase">
                  <Target className="size-3.5 text-highlight" />
                  <span>Course Learning Objectives</span>
                </div>
                <span className="font-mono text-[10px] text-fg-muted">
                  {course.goals.filter((g) => g.done).length}/{course.goals.length} done
                </span>
              </div>

              <div className="space-y-1.5">
                {course.goals.length === 0 ? (
                  <p className="py-3 text-xs text-fg-muted">
                    Add learning goals or mini-project milestones for this course.
                  </p>
                ) : (
                  course.goals.map((goal) => (
                    <div
                      key={goal.id}
                      className="group flex items-center justify-between gap-2 border border-line bg-panel px-2.5 py-2 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => onToggleGoal(goal.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                      >
                        <span
                          className={`flex size-4 shrink-0 items-center justify-center border ${
                            goal.done ? 'border-ink bg-mint text-ink' : 'border-line-strong'
                          }`}
                        >
                          {goal.done && <Check className="size-3" strokeWidth={2.5} />}
                        </span>
                        <span className={goal.done ? 'text-fg-muted line-through' : 'text-fg'}>
                          {goal.text}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteGoal(goal.id)}
                        className="text-fg-muted opacity-0 group-hover:opacity-100 hover:text-peach cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!goalInput.trim()) return;
                  onAddGoal(goalInput);
                  setGoalInput('');
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  type="text"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder="Add an objective (e.g. Build final capstone project)…"
                  className="h-8 flex-1 border border-line bg-panel px-2.5 text-xs text-fg placeholder:text-fg-muted outline-none focus:border-ink"
                />
                <Button type="submit" variant="ink" size="sm">
                  <Plus className="size-3.5" />
                  Add
                </Button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-4">
            <form onSubmit={handleCreateNote} className="border border-line-strong bg-panel-head/50 p-3.5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 border border-ink bg-mint px-2 py-0.5 font-mono text-[11px] font-semibold text-ink">
                    <Clock className="size-3" />
                    {formatDuration(pinnedTime ?? currentPlaybackSeconds)}
                  </span>
                  <div className="flex items-center gap-1">
                    {NOTE_TAGS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setNoteTag(t.id)}
                        className={`border px-2 py-0.5 font-mono text-[10px] transition cursor-pointer ${
                          noteTag === t.id
                            ? `${t.style} font-semibold`
                            : 'border-line bg-panel text-fg-muted hover:text-fg'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button type="button" variant="ghost" size="xs" onClick={onExportNotes}>
                  <Download className="size-3" />
                  Export .md
                </Button>
              </div>

              <textarea
                ref={noteInputRef}
                rows={3}
                value={noteInput}
                onFocus={() => {
                  if (pinnedTime === null) setPinnedTime(Math.floor(currentPlaybackSeconds));
                  if (autoPauseOnNote) onPauseVideo();
                }}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateNote(e);
                  }
                }}
                placeholder="Capture a timestamped note… (⌘↵ to save)"
                className="w-full border border-line bg-panel p-2.5 text-xs leading-relaxed text-fg placeholder:text-fg-muted outline-none focus:border-ink"
              />

              <div className="mt-2 flex items-center justify-between">
                <span className="font-mono text-[10px] text-fg-muted">
                  Tip: Press N anytime during playback to snap a timestamped note.
                </span>
                <Button type="submit" variant="ink" size="xs" disabled={!noteInput.trim()}>
                  Save Note
                </Button>
              </div>
            </form>

            {lesson.notes.length === 0 ? (
              <div className="border border-dashed border-line-strong bg-hatch p-8 text-center">
                <p className="text-xs font-medium text-fg">No notes for this lesson yet.</p>
                <p className="mt-1 text-[11px] text-fg-muted">
                  Every note is pinned to the exact second so you can jump back later.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {lesson.notes.map((note) => {
                  const tagMeta = NOTE_TAGS.find((t) => t.id === note.tag);
                  return (
                    <div
                      key={note.id}
                      className="group flex items-start gap-3 border border-line bg-panel p-3 hover:border-line-strong"
                    >
                      <button
                        type="button"
                        onClick={() => onSeekTo(note.timestamp)}
                        className="shrink-0 border border-ink bg-mint px-2 py-0.5 font-mono text-[11px] font-semibold text-ink hover:bg-teal cursor-pointer"
                        title="Jump to timestamp"
                      >
                        {formatDuration(note.timestamp)}
                      </button>

                      <div className="min-w-0 flex-1">
                        {tagMeta && (
                          <span
                            className={`mb-1 inline-block border px-1.5 py-0.2 font-mono text-[9px] uppercase ${tagMeta.style}`}
                          >
                            {tagMeta.label}
                          </span>
                        )}
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-fg">
                          {note.content}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteNote(note.id)}
                        className="text-fg-muted opacity-0 transition group-hover:opacity-100 hover:text-peach cursor-pointer"
                        title="Delete note"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'bookmarks' && (
          <div className="space-y-4">
            <form onSubmit={handleCreateBookmark} className="flex gap-2">
              <span className="inline-flex items-center border border-ink bg-peach px-2.5 font-mono text-xs font-semibold text-ink">
                {formatDuration(currentPlaybackSeconds)}
              </span>
              <input
                type="text"
                value={bookmarkLabel}
                onChange={(e) => setBookmarkLabel(e.target.value)}
                placeholder="Label this moment (e.g. Architecture diagram, Key formula)…"
                className="h-8 flex-1 border border-line bg-panel px-2.5 text-xs text-fg placeholder:text-fg-muted outline-none focus:border-ink"
              />
              <Button type="submit" variant="ink" size="sm">
                <Bookmark className="size-3.5" />
                Bookmark
              </Button>
            </form>

            {lesson.bookmarks.length === 0 ? (
              <div className="border border-dashed border-line-strong bg-hatch p-8 text-center text-xs text-fg-muted">
                Press <kbd className="border border-line bg-panel px-1 font-mono">B</kbd> during
                playback to drop a clickable bookmark on the scrubber.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {lesson.bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className="group flex items-center justify-between gap-2 border border-line bg-panel p-2.5 hover:border-ink"
                  >
                    <button
                      type="button"
                      onClick={() => onSeekTo(bm.timestamp)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
                    >
                      <span className="border border-ink bg-peach px-2 py-0.5 font-mono text-[11px] font-semibold text-ink">
                        {formatDuration(bm.timestamp)}
                      </span>
                      <span className="truncate text-xs font-medium text-fg">{bm.label}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBookmark(bm.id)}
                      className="text-fg-muted opacity-0 group-hover:opacity-100 hover:text-peach cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'resources' && (
          <div>
            {allResources.length === 0 ? (
              <div className="border border-dashed border-line-strong bg-hatch p-8 text-center">
                <p className="text-xs font-medium text-fg">
                  No companion documents found in this folder.
                </p>
                <p className="mt-1 text-[11px] text-fg-muted">
                  PDFs, Markdown files, slide decks, and ZIP starter packs placed inside the course
                  folder appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {allResources.map((res) => (
                  <div
                    key={res.id}
                    className="flex items-center justify-between gap-3 border border-line bg-panel-head/40 p-3 hover:border-ink"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center border border-ink/30 bg-mint-soft font-mono text-[10px] font-semibold text-ink">
                        {res.ext}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-fg">{res.name}</div>
                        <div className="font-mono text-[10px] text-fg-muted">
                          {formatFileSize(res.size)}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void window.playmachine?.openPath(res.filePath)}
                        title="Open file"
                        className="inline-flex size-7 items-center justify-center border border-line bg-panel text-fg hover:border-ink hover:bg-mint hover:text-ink cursor-pointer"
                      >
                        <ExternalLink className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void window.playmachine?.revealInFinder(res.filePath)}
                        title="Reveal in Finder"
                        className="inline-flex size-7 items-center justify-center border border-line bg-panel text-fg-muted hover:border-ink hover:text-fg cursor-pointer"
                      >
                        <FolderOpen className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'flashcards' && (
          <div className="space-y-4">
            <form
              onSubmit={handleCreateCard}
              className="grid gap-2.5 border border-line-strong bg-panel-head/50 p-3.5 md:grid-cols-2"
            >
              <div>
                <label className="mb-1 block font-mono text-[10px] text-fg-muted uppercase">
                  Prompt / Question
                </label>
                <input
                  type="text"
                  value={cardQ}
                  onChange={(e) => setCardQ(e.target.value)}
                  placeholder="e.g. When does useEffect cleanup run?"
                  className="h-8 w-full border border-line bg-panel px-2.5 text-xs text-fg outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] text-fg-muted uppercase">
                  Answer
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cardA}
                    onChange={(e) => setCardA(e.target.value)}
                    placeholder="Before re-running the effect and on unmount."
                    className="h-8 flex-1 border border-line bg-panel px-2.5 text-xs text-fg outline-none focus:border-ink"
                  />
                  <Button
                    type="submit"
                    variant="ink"
                    size="sm"
                    disabled={!cardQ.trim() || !cardA.trim()}
                  >
                    <Plus className="size-3.5" />
                    Add
                  </Button>
                </div>
              </div>
            </form>

            {lesson.flashcards.length === 0 ? (
              <div className="border border-dashed border-line-strong bg-hatch p-8 text-center text-xs text-fg-muted">
                Create active-recall flashcards for this lesson to test retention after watching.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {lesson.flashcards.map((card) => {
                  const flipped = Boolean(flippedCards[card.id]);
                  return (
                    <div
                      key={card.id}
                      className={`flex flex-col justify-between border p-4 transition ${
                        card.mastered
                          ? 'border-ink bg-mint-soft/50'
                          : 'border-line-strong bg-panel shadow-[2px_2px_0_0_var(--line)]'
                      }`}
                    >
                      <div
                        onClick={() =>
                          setFlippedCards((prev) => ({ ...prev, [card.id]: !prev[card.id] }))
                        }
                        className="min-h-[68px] cursor-pointer"
                      >
                        <div className="mb-1 font-mono text-[10px] tracking-wider text-highlight uppercase">
                          {flipped ? 'Answer (click to flip)' : 'Question (click to reveal)'}
                        </div>
                        <p className="text-xs leading-relaxed font-medium text-fg">
                          {flipped ? card.answer : card.question}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                        <button
                          type="button"
                          onClick={() => onToggleFlashcardMastered(card.id)}
                          className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] cursor-pointer ${
                            card.mastered
                              ? 'border-ink bg-mint font-semibold text-ink'
                              : 'border-line bg-panel-head text-fg-muted hover:text-fg'
                          }`}
                        >
                          <Check className="size-3" />
                          {card.mastered ? 'Mastered' : 'Mark mastered'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteFlashcard(card.id)}
                          className="text-fg-muted hover:text-peach cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
