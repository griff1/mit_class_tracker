"use client";

import { useRef } from "react";
import { Avatar } from "@/components/avatar";

/**
 * Avatar that opens a modal lightbox showing the full-size photo on click.
 * Uses the native <dialog> element so Escape-to-close and focus trap work
 * without bringing in a modal library. Backdrop click also dismisses.
 *
 * Only used when a photoUrl is present — initial-only avatars stay as the
 * plain non-interactive Avatar.
 */
export function ClickablePhotoAvatar({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={`View larger photo of ${name}`}
        className="cursor-zoom-in rounded-md transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <Avatar name={name} size="md" photoUrl={photoUrl} />
      </button>
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          // Backdrop click closes; clicks inside the content do nothing.
          if (e.target === dialogRef.current) {
            dialogRef.current?.close();
          }
        }}
        className="m-auto max-w-[min(640px,90vw)] rounded-md border border-line bg-paper p-0 text-ink backdrop:bg-ink/70"
      >
        <div className="flex flex-col gap-3 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt={name}
            className="max-h-[70vh] w-full rounded object-contain"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-ink">{name}</span>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-line-2 bg-paper px-3 py-1 text-xs font-medium text-ink-2 transition hover:border-brand-400 hover:text-ink"
            >
              Close
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
