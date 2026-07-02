import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Input, Select } from "@/components/inputs";
import { SubmitButton } from "@/components/submit-button";
import { setJobAlerts, submitJob, toggleJobFilled } from "./actions";
import { JobFields } from "./job-form-fields";
import {
  JOB_SELECT,
  JobCard,
  JobStatusPill,
  fmtDate,
  type JobRow,
} from "./job-card";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    submitted?: string;
    updated?: string;
    deleted?: string;
    filled?: string;
    reopened?: string;
    alerts?: string;
    error?: string;
  }>;
}) {
  const {
    q: rawQ,
    submitted,
    updated,
    deleted,
    filled,
    reopened,
    alerts,
    error,
  } = await searchParams;
  const q = (rawQ ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const viewer = await getViewer(supabase, user);

  // Approved feed, newest first. Search is a simple ilike across the four
  // text columns; commas/parens are stripped from the pattern because they
  // are structural characters in PostgREST's .or() syntax.
  let feedQuery = supabase
    .from("job_postings")
    .select(JOB_SELECT)
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (q) {
    const pat = `%${q.replace(/[,()]/g, " ")}%`;
    feedQuery = feedQuery.or(
      `title.ilike.${pat},company.ilike.${pat},location.ilike.${pat},description.ilike.${pat}`,
    );
  }
  const { data: jobs, error: feedError } = await feedQuery.returns<JobRow[]>();

  // The member's own submissions, any status (RLS scopes non-approved
  // visibility to the poster), so pending/rejected state is visible to them.
  const { data: mine } = await supabase
    .from("job_postings")
    .select("id, title, company, status, created_at")
    .eq("posted_by", user.id)
    .order("created_at", { ascending: false })
    .returns<
      Pick<JobRow, "id" | "title" | "company" | "status" | "created_at">[]
    >();

  // Current member's email-alert preference (drives the subscribe control).
  const { data: prefRow } = await supabase
    .from("profiles")
    .select("job_alert_frequency")
    .eq("id", user.id)
    .maybeSingle<{ job_alert_frequency: string | null }>();
  const alertFreq = prefRow?.job_alert_frequency ?? "off";

  // Admin? Show the review-queue link with a pending count.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  let pendingCount = 0;
  if (isAdmin) {
    const { count } = await supabase
      .from("job_postings")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingCount = count ?? 0;
  }

  return (
    <AppShell active="jobs" user={viewer}>
      <PageHeader
        eyebrow="Sloanies helping Sloanies"
        title="Opportunities"
        badge="Beta"
        count={
          jobs
            ? `${jobs.length} ${jobs.length === 1 ? "posting" : "postings"}`
            : "—"
        }
      />

      {isAdmin && (
        <Link
          href="/jobs/review"
          className="block rounded-md border border-brand-100 bg-brand-50/60 px-4 py-2.5 text-sm text-ink transition hover:bg-brand-50"
        >
          <span className="font-medium">Review queue</span> —{" "}
          {pendingCount === 0
            ? "no postings waiting."
            : `${pendingCount} ${
                pendingCount === 1 ? "posting" : "postings"
              } waiting for approval.`}{" "}
          →
        </Link>
      )}

      {submitted && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800">
          Posting submitted. It goes live once it&apos;s been reviewed —
          you&apos;ll see its status under &ldquo;Your submissions&rdquo; below.
        </p>
      )}
      {updated && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800">
          Posting updated.
        </p>
      )}
      {deleted && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800">
          Posting deleted.
        </p>
      )}
      {filled && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800">
          Listing marked filled — it&apos;s no longer shown on the board. You
          can reopen it from &ldquo;Your submissions&rdquo;.
        </p>
      )}
      {reopened && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800">
          Listing reopened — it&apos;s live on the board again.
        </p>
      )}
      {alerts === "saved" && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800">
          Job alert preference saved.
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <Section label="Browse" index={1}>
        <form action="/jobs" method="get" className="flex items-center gap-2">
          <Input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search title, company, location…"
          />
          <button
            type="submit"
            className="flex-none rounded-md bg-ink px-3.5 py-2 text-xs font-medium text-cream transition hover:bg-ink-2"
          >
            Search
          </button>
          {q && (
            <Link
              href="/jobs"
              className="flex-none text-xs text-ink-2 underline-offset-4 hover:text-brand-700 hover:underline"
            >
              Clear
            </Link>
          )}
        </form>

        {feedError && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
            Couldn&apos;t load postings: {feedError.message}
          </p>
        )}
        {!feedError && jobs && jobs.length === 0 && (
          <p className="mt-3 text-sm text-ink-3">
            {q
              ? "No postings match that search."
              : "No postings yet. Share the first one below."}
          </p>
        )}
        {!feedError && jobs && jobs.length > 0 && (
          <ul className="mt-3 flex flex-col gap-3">
            {jobs.map((j) => (
              <JobCard key={j.id} job={j} canManage={!!isAdmin} />
            ))}
          </ul>
        )}
      </Section>

      <Section label="Email alerts" index={2}>
        <form action={setJobAlerts} className="flex flex-col gap-2">
          <p className="text-sm text-ink-2">
            Get emailed about new postings. Change the frequency or turn it off
            anytime.
          </p>
          <div className="flex items-center gap-2">
            <Select name="frequency" defaultValue={alertFreq}>
              <option value="off">Off</option>
              <option value="instant">Each new posting</option>
              <option value="weekly">Weekly digest</option>
            </Select>
            <button
              type="submit"
              className="flex-none rounded-md bg-ink px-3.5 py-2 text-xs font-medium text-cream transition hover:bg-ink-2"
            >
              Save
            </button>
          </div>
        </form>
      </Section>

      <form action={submitJob} className="flex flex-col gap-3">
        <Section label="Share an opportunity" index={3}>
          <JobFields />
          <p className="pt-1 text-xs text-ink-3">
            Postings are reviewed before going live.
          </p>
          <div className="flex justify-end pt-2">
            <SubmitButton pendingLabel="Submitting…">
              Submit for review
            </SubmitButton>
          </div>
        </Section>
      </form>

      {mine && mine.length > 0 && (
        <Section label="Your submissions" index={4}>
          <ul className="flex flex-col">
            {mine.map((j, idx) => (
              <li
                key={j.id}
                className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 ${
                  idx === 0 ? "" : "border-t border-line"
                }`}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-ink">
                    {j.title}{" "}
                    <span className="font-normal text-ink-2">
                      — {j.company}
                    </span>
                  </span>
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-3">
                    submitted {fmtDate(j.created_at)}
                  </span>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <JobStatusPill status={j.status} />
                  {j.status === "approved" && (
                    <form action={toggleJobFilled}>
                      <input type="hidden" name="id" value={j.id} />
                      <input type="hidden" name="filled" value="true" />
                      <button
                        type="submit"
                        className="rounded-md border border-line-2 bg-paper px-2.5 py-1 text-xs font-medium text-ink-2 transition hover:bg-cream"
                      >
                        Mark filled
                      </button>
                    </form>
                  )}
                  {j.status === "closed" && (
                    <form action={toggleJobFilled}>
                      <input type="hidden" name="id" value={j.id} />
                      <input type="hidden" name="filled" value="false" />
                      <button
                        type="submit"
                        className="rounded-md border border-line-2 bg-paper px-2.5 py-1 text-xs font-medium text-ink-2 transition hover:bg-cream"
                      >
                        Reopen
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </AppShell>
  );
}
