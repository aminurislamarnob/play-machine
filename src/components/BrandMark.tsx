import React from 'react';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * Playmachine custom mascot mark — playful mint & teal geometry with crisp #022435 ink outlines
 * inspired by Faddy's tactile editorial aesthetic.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 24, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Offset teal shadow block */}
      <rect x="8" y="10" width="34" height="32" rx="9" fill="#42BFBF" />
      {/* Main playful mint body */}
      <rect
        x="5"
        y="6"
        width="34"
        height="32"
        rx="9"
        fill="#AAF3CE"
        stroke="#022435"
        strokeWidth="2.6"
      />
      {/* Subtle glossy highlight */}
      <path
        d="M11 12.5C11 11.4 11.9 10.5 13 10.5H19"
        stroke="#FFFDF7"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Little peach corner dot accent */}
      <circle cx="31.5" cy="12.5" r="2.5" fill="#FCA890" stroke="#022435" strokeWidth="1.5" />
      {/* Play triangle badge inside */}
      <path
        d="M18.5 16.8L29.2 22.8C29.9 23.2 29.9 24.2 29.2 24.6L18.5 30.6C17.8 31 17 30.5 17 29.7V17.7C17 16.9 17.8 16.4 18.5 16.8Z"
        fill="#022435"
      />
      {/* Bright glint inside play button */}
      <circle cx="20.6" cy="21.5" r="1.4" fill="#AAF3CE" />
    </svg>
  );
};

export const BrandMascotCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`relative inline-flex items-center justify-center border border-ink bg-paper p-3 shadow-offset-teal ${className}`}
  >
    <BrandMark size={48} className="animate-bob" />
  </div>
);
