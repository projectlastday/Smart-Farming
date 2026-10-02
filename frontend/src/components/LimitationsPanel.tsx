import type { ReactNode } from 'react';

interface LimitationsPanelProps {
  title?: string;
  children: ReactNode;
}

/** Displays scientific limitations disclaimer for feature pages. */
export function LimitationsPanel({
  title = 'Keterbatasan Ilmiah',
  children,
}: LimitationsPanelProps) {
  return (
    <aside className="limitations">
      <h4>{title}</h4>
      {children}
    </aside>
  );
}
