import React from 'react';

type ButtonVariant = 'ink' | 'ivory' | 'mint' | 'ghost' | 'danger';
type ButtonSize = 'xs' | 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  ink: 'btn-faddy-ink',
  ivory: 'btn-faddy-ivory',
  mint: 'btn-faddy-mint',
  ghost:
    'border border-transparent bg-transparent text-fg hover:bg-panel-head hover:border-line',
  danger:
    'border border-ink bg-peach text-ink shadow-[inset_0_2px_0_rgb(255_255_255/0.45),inset_0_-2px_0_rgb(255_255_255/0.45)] hover:brightness-95',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1.5',
  sm: 'h-8 px-3.5 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'ivory',
  size = 'sm',
  className = '',
  children,
  ...rest
}) => {
  return (
    <button
      {...rest}
      className={`group/btn inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap select-none cursor-pointer transition-[background-color,border-color,color,filter,transform] duration-150 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-45 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    >
      {children}
    </button>
  );
};
