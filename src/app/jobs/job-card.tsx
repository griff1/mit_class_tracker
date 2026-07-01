import { safeHttpUrl } from "@/lib/url-safety";

/**
 * Shared pieces for the jobs feed (/jobs) and the admin review queue
 * (/jobs/review): the posting row shape + select string, the posting card,
 * and the status pill. Lives outside the page files because Next.js page
 * modules may only export the route contract (default component, metadata…).
 */

export type JobRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  apply_url: string | null;
  contact: string | null;
  description: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  posted_by: string;
  profiles: { name: string | null; mit_email: string } | null;
};

export const JOB_SELECT =
  "id, title, company, location, apply_url, contact, description, status, created_at, posted_by, profiles(name, mit_email)";

export function JobCard({ job }: { job: JobRow }) {
  const posterName =
    job.profiles?.name?.trim() || job.profiles?.mit_email || "A member";
  // Render-time URL guard, same defense-in-depth as LinkedIn links.
  const applyHref = safeHttpUrl(job.apply_url);
  return (
    <li className="rounded-md border border-line bg-paper p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold tracking-tight text-ink">
          {job.title}
        </h3>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-3">
          {fmtDate(job.created_at)}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-ink-2">
        {job.company}
        {job.location ? ` · ${job.location}` : ""}
      </p>
      <p className="mt-2 whitespace-pre-line text-sm text-ink-2">
        {job.description}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2.5">
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-3">
          via {posterName}
        </span>
        {job.contact && (
          <span className="font-mono text-[0.6rem] tracking-[0.02em] text-ink-2">
            {job.contact}
          </span>
        )}
        {applyHref && (
          <a
            href={applyHref}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs font-medium text-brand-700 underline-offset-4 hover:underline"
          >
            Apply →
          </a>
        )}
      </div>
    </li>
  );
}

export function JobStatusPill({ status }: { status: JobRow["status"] }) {
  if (status === "approved") {
    return (
      <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-emerald-800">
        Live
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="rounded-sm border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-red-800">
        Not approved
      </span>
    );
  }
  return (
    <span className="rounded-sm border border-line px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-3">
      In review
    </span>
  );
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
