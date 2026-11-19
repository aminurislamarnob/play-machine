import React from 'react';
import { Check, Info, Sparkles } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  tone?: 'mint' | 'peach' | 'ink';
}

interface ToastStackProps {
  toasts: ToastMessage[];
}

export const ToastStack: React.FC<ToastStackProps> = ({ toasts }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-50 flex flex-col items-end gap-2">
      {toasts.map((toast) => {
        const style =
          toast.tone === 'peach'
            ? 'border-ink bg-peach text-ink shadow-offset-ink'
            : toast.tone === 'ink'
              ? 'border-ink-950 bg-ink text-ivory shadow-offset-mint'
              : 'border-ink bg-mint text-ink shadow-offset-ink';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2 border px-3.5 py-2 text-xs font-medium tracking-tight ${style}`}
          >
            {toast.tone === 'peach' ? (
              <Info className="size-3.5 shrink-0" strokeWidth={1.8} />
            ) : toast.tone === 'ink' ? (
              <Sparkles className="size-3.5 shrink-0 text-mint" strokeWidth={1.8} />
            ) : (
              <Check className="size-3.5 shrink-0" strokeWidth={2} />
            )}
            <span>{toast.text}</span>
          </div>
        );
      })}
    </div>
  );
};
