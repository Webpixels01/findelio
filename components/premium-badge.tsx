import type { ReactNode } from "react";

export default function PremiumBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] px-3 text-xs font-extrabold uppercase leading-none tracking-wider text-white">
      <span className="translate-y-px">{children}</span>
    </span>
  );
}
