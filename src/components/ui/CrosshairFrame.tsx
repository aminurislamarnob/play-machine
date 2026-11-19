import React from 'react';

interface CrosshairProps {
  className?: string;
}

export const CrosshairTick: React.FC<CrosshairProps> = ({ className = '' }) => (
  <span
    aria-hidden="true"
    className={`pointer-events-none absolute z-10 flex size-3 items-center justify-center text-fg-muted/70 select-none ${className}`}
  >
    <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M6 0v12M0 6h12" />
    </svg>
  </span>
);

interface CrosshairFrameProps {
  children: React.ReactNode;
  className?: string;
  showTicks?: boolean;
}

export const CrosshairFrame: React.FC<CrosshairFrameProps> = ({
  children,
  className = '',
  showTicks = true,
}) => (
  <div className={`relative border border-line ${className}`}>
    {showTicks && (
      <>
        <CrosshairTick className="-top-1.5 -left-1.5" />
        <CrosshairTick className="-top-1.5 -right-1.5" />
        <CrosshairTick className="-bottom-1.5 -left-1.5" />
        <CrosshairTick className="-bottom-1.5 -right-1.5" />
      </>
    )}
    {children}
  </div>
);
