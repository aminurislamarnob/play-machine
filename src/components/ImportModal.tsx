import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  FileVideo,
  FolderKanban,
  FolderOpen,
  Layers,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  CourseAccent,
  FolderScanPreview,
  ImportConfirmPayload,
  ImportMode,
  ScannedCourseDraft,
} from '@shared/types';
import { Button } from './ui/Button';

interface ImportModalProps {
  preview: FolderScanPreview | null;
  loading: boolean;
  onClose: () => void;
  onPickAnotherFolder: () => void;
  onConfirm: (payload: ImportConfirmPayload) => Promise<void>;
}

const ACCENTS: CourseAccent[] = ['mint', 'teal', 'peach', 'iris'];

interface DraftEditState {
  selected: boolean;
  title: string;
  accent: CourseAccent;
  tagsInput: string;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  preview,
  loading,
  onClose,
  onPickAnotherFolder,
  onConfirm,
}) => {
  const [mode, setMode] = useState<ImportMode>('single');
  const [edits, setEdits] = useState<Record<string, DraftEditState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [expandedDraftPath, setExpandedDraftPath] = useState<string | null>(null);

  useEffect(() => {
    if (!preview) return;
    setMode(preview.suggestedMode);

    const allDrafts: ScannedCourseDraft[] = [
      ...(preview.singleCourse ? [preview.singleCourse] : []),
      ...preview.collectionCourses,
    ];
    const nextEdits: Record<string, DraftEditState> = {};
    for (const draft of allDrafts) {
      nextEdits[draft.folderPath] = {
        selected: true,
        title: draft.title,
        accent: draft.accent,
        tagsInput: '',
      };
    }
    setEdits(nextEdits);
    const first =
      preview.suggestedMode === 'collection'
        ? preview.collectionCourses[0]
        : preview.singleCourse;
    setExpandedDraftPath(first?.folderPath ?? null);
  }, [preview]);

  if (!preview && !loading) return null;

  const activeDrafts: ScannedCourseDraft[] = !preview
    ? []
    : mode === 'collection'
      ? preview.collectionCourses
      : preview.singleCourse
        ? [preview.singleCourse]
        : [];

  const selectedCount = activeDrafts.filter((d) => edits[d.folderPath]?.selected).length;
  const totalSelectedVideos = activeDrafts
    .filter((d) => edits[d.folderPath]?.selected)
    .reduce((sum, d) => sum + d.totalVideos, 0);

  const handleConfirm = async () => {
    if (!preview || selectedCount === 0) return;
    setSubmitting(true);
    try {
      const payload: ImportConfirmPayload = {
        mode,
        rootPath: preview.rootPath,
        courses: activeDrafts
          .filter((d) => edits[d.folderPath]?.selected)
          .map((d) => {
            const edit = edits[d.folderPath];
            const tags = (edit?.tagsInput || '')
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean);
            return {
              folderPath: d.folderPath,
              title: edit?.title || d.title,
              accent: edit?.accent || d.accent,
              tags,
            };
          }),
      };
      await onConfirm(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-6 backdrop-blur-[2px]">
      <div className="flex max-h-[86vh] w-full max-w-4xl flex-col border border-ink bg-panel shadow-[6px_6px_0_0_var(--color-teal)]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line bg-mint px-5 py-3.5 text-ink">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center border border-ink bg-paper">
              <Sparkles className="size-4 text-iris-ink" strokeWidth={1.7} />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                Import Local Course Folder
              </h2>
              <p className="font-mono text-[11px] text-ink/75">
                {preview?.rootPath ?? 'Scanning videos and generating lesson titles…'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center border border-ink/25 bg-paper text-ink hover:bg-ivory cursor-pointer"
          >
            <X className="size-4" strokeWidth={1.7} />
          </button>
        </div>

        {loading || !preview ? (
          <div className="flex flex-col items-center justify-center gap-3 p-14 text-center">
            <div className="size-8 animate-spin border-2 border-line border-t-ink" />
            <p className="text-sm font-medium text-fg">
              Scanning directory & generating clean lesson titles…
            </p>
          </div>
        ) : activeDrafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
            <div className="border border-line-strong bg-hatch p-4">
              <FileVideo className="size-8 text-fg-muted" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-fg">No Video Files Found</h3>
              <p className="mt-1 max-w-md text-xs text-fg-muted">
                We scanned <span className="font-mono">{preview.rootName}</span> and did not find
                any supported video files (.mp4, .mkv, .mov, .webm, .m4v). Pick another folder.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ink" onClick={onPickAnotherFolder}>
                <FolderOpen className="size-3.5" />
                Choose Another Folder
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Mode Switcher Bar (Single Course vs Collection of Courses) */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel-head px-5 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('single');
                    setExpandedDraftPath(preview.singleCourse?.folderPath ?? null);
                  }}
                  className={`inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    mode === 'single'
                      ? 'border-ink bg-ink text-ivory'
                      : 'border-line bg-panel text-fg-muted hover:text-fg'
                  }`}
                >
                  <Layers className="size-3.5" strokeWidth={1.6} />
                  <span>1 Course with Modules</span>
                  {preview.singleCourse && (
                    <span className="font-mono text-[10px] opacity-75">
                      ({preview.singleCourse.sections.length} sec · {preview.singleCourse.totalVideos}{' '}
                      videos)
                    </span>
                  )}
                </button>

                {preview.canImportAsCollection && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('collection');
                      setExpandedDraftPath(preview.collectionCourses[0]?.folderPath ?? null);
                    }}
                    className={`inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                      mode === 'collection'
                        ? 'border-ink bg-ink text-ivory'
                        : 'border-line bg-panel text-fg-muted hover:text-fg'
                    }`}
                  >
                    <FolderKanban className="size-3.5" strokeWidth={1.6} />
                    <span>Course Collection</span>
                    <span className="font-mono text-[10px] opacity-75">
                      ({preview.collectionCourses.length} courses)
                    </span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onPickAnotherFolder}
                className="text-xs font-medium text-highlight underline underline-offset-2 hover:opacity-80 cursor-pointer"
              >
                Change folder
              </button>
            </div>

            {/* Course Drafts + Auto-Generated Lesson Title Preview */}
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {activeDrafts.map((draft) => {
                const edit = edits[draft.folderPath] ?? {
                  selected: true,
                  title: draft.title,
                  accent: draft.accent,
                  tagsInput: '',
                };
                const isExpanded = expandedDraftPath === draft.folderPath;

                return (
                  <div
                    key={draft.folderPath}
                    className={`border transition ${
                      edit.selected ? 'border-line-strong bg-panel' : 'border-line bg-panel-head/50 opacity-60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-3 border-b border-line bg-panel-head px-4 py-3">
                      {mode === 'collection' && (
                        <button
                          type="button"
                          onClick={() =>
                            setEdits((prev) => ({
                              ...prev,
                              [draft.folderPath]: { ...edit, selected: !edit.selected },
                            }))
                          }
                          className={`flex size-4 shrink-0 items-center justify-center border cursor-pointer ${
                            edit.selected
                              ? 'border-ink bg-mint text-ink'
                              : 'border-line-strong bg-panel'
                          }`}
                        >
                          {edit.selected && <Check className="size-3" strokeWidth={2.5} />}
                        </button>
                      )}

                      <div className="min-w-[200px] flex-1">
                        <label className="mb-0.5 block font-mono text-[10px] text-fg-muted uppercase">
                          Course Title (auto-generated)
                        </label>
                        <input
                          type="text"
                          value={edit.title}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [draft.folderPath]: { ...edit, title: e.target.value },
                            }))
                          }
                          className="w-full border border-line bg-panel px-2.5 py-1 text-sm font-semibold text-fg outline-none focus:border-ink"
                        />
                      </div>

                      <div className="w-40">
                        <label className="mb-0.5 block font-mono text-[10px] text-fg-muted uppercase">
                          Tags (comma sep.)
                        </label>
                        <input
                          type="text"
                          placeholder="react, frontend"
                          value={edit.tagsInput}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [draft.folderPath]: { ...edit, tagsInput: e.target.value },
                            }))
                          }
                          className="w-full border border-line bg-panel px-2 py-1 text-xs text-fg outline-none focus:border-ink"
                        />
                      </div>

                      <div>
                        <label className="mb-0.5 block font-mono text-[10px] text-fg-muted uppercase">
                          Accent
                        </label>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          {ACCENTS.map((acc) => {
                            const bgClass =
                              acc === 'mint'
                                ? 'bg-mint'
                                : acc === 'teal'
                                  ? 'bg-teal'
                                  : acc === 'peach'
                                    ? 'bg-peach'
                                    : 'bg-iris';
                            return (
                              <button
                                key={acc}
                                type="button"
                                onClick={() =>
                                  setEdits((prev) => ({
                                    ...prev,
                                    [draft.folderPath]: { ...edit, accent: acc },
                                  }))
                                }
                                title={acc}
                                className={`size-5 border cursor-pointer ${bgClass} ${
                                  edit.accent === acc
                                    ? 'border-ink ring-2 ring-ink/30'
                                    : 'border-ink/30 opacity-70 hover:opacity-100'
                                }`}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDraftPath(isExpanded ? null : draft.folderPath)
                        }
                        className="ml-auto border border-line bg-panel px-2.5 py-1.5 font-mono text-[11px] text-fg hover:border-line-strong cursor-pointer"
                      >
                        {draft.sections.length} modules · {draft.totalVideos} lessons{' '}
                        {isExpanded ? '▴' : '▾'}
                      </button>
                    </div>

                    {/* Side-by-side filename -> generated lesson title preview */}
                    {isExpanded && (
                      <div className="divide-y divide-line">
                        {draft.sections.map((section) => (
                          <div key={section.id} className="p-3.5">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-semibold text-fg">
                                {section.title}
                              </span>
                              <span className="font-mono text-[10px] text-fg-muted">
                                {section.lessons.length} videos
                                {section.resources.length > 0 &&
                                  ` · ${section.resources.length} resources`}
                              </span>
                            </div>

                            <div className="space-y-1">
                              {section.lessons.slice(0, 10).map((lesson) => (
                                <div
                                  key={lesson.id}
                                  className="grid grid-cols-[28px_1fr_auto_1fr] items-center gap-2 border border-line/70 bg-panel-head/40 px-2.5 py-1.5 text-xs"
                                >
                                  <span className="font-mono text-[11px] font-medium text-highlight">
                                    {lesson.displayIndex}
                                  </span>
                                  <span className="truncate font-medium text-fg">
                                    {lesson.generatedTitle}
                                  </span>
                                  <ArrowRight className="size-3 text-fg-muted/50" />
                                  <span className="truncate text-right font-mono text-[10px] text-fg-muted">
                                    {lesson.originalFileName}
                                  </span>
                                </div>
                              ))}
                              {section.lessons.length > 10 && (
                                <p className="pt-1 font-mono text-[10px] text-fg-muted">
                                  + {section.lessons.length - 10} more auto-titled lessons in this
                                  module
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-line bg-panel-head px-5 py-3.5">
              <div className="font-mono text-xs text-fg-muted">
                Ready to import{' '}
                <span className="font-semibold text-fg">
                  {selectedCount} {selectedCount === 1 ? 'course' : 'courses'}
                </span>{' '}
                ({totalSelectedVideos} lessons)
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="ink"
                  size="md"
                  disabled={selectedCount === 0 || submitting}
                  onClick={handleConfirm}
                >
                  <span>{submitting ? 'Importing…' : 'Create Course Library'}</span>
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
