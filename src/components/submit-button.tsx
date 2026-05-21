"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button that disables itself and shows a pending indicator while the
 * enclosing <form>'s server action is in flight. Use inside any server-action
 * <form> when the action can take noticeable time (e.g. photo upload). No
 * client state beyond useFormStatus, which Next/React 19 wires up
 * automatically from the parent <form>.
 *
 * Default classes match the app's primary CTA (bg-ink / text-cream). Pass
 * `className` to override (e.g. for secondary buttons). The pending indicator
 * uses three rounded-sm dots — not a ring spinner — to respect the design
 * system's no-rounded-full rule.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const base =
    className ??
    "rounded-md bg-ink px-5 py-2 text-sm font-medium text-cream transition hover:bg-ink-2";
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={`${base} disabled:cursor-not-allowed disabled:opacity-70`}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <ProgressDots />
          {pendingLabel ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

function ProgressDots() {
  return (
    <span aria-hidden className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-pulse rounded-sm bg-cream/90 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-sm bg-cream/90 [animation-delay:200ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-sm bg-cream/90 [animation-delay:400ms]" />
    </span>
  );
}
