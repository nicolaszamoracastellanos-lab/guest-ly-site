import type { ReactNode } from 'react';

/* Reusable glassmorphism panel. Recipe lives in .glass / .glass-card
   (ui/overlay.css); pass className for per-use layout tweaks. */
export function GlassCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `glass glass-card ${className}` : 'glass glass-card'}>{children}</div>;
}
