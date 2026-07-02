import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { SubmitButton } from "@/components/submit-button";
import { deleteJob, updateJob } from "../../actions";
import { JobFields } from "../../job-form-fields";
import { JobStatusPill, type JobRow } from "../../job-card";

/**
 * Admin-only edit + delete for a single posting (approved or otherwise). RLS is
 * the real gate — non-admins can't UPDATE/DELETE and can't SELECT non-approved
 * rows — but we redirect here for clean UX.
 */
export default async function EditJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/jobs");

  const viewer = await getViewer(supabase, user);

  const { data: job } = await supabase
    .from("job_postings")
    .select(
      "id, title, company, location, apply_url, contact, description, status, created_at",
    )
    .eq("id", id)
    .maybeSingle<
      Pick<
        JobRow,
        | "id"
        | "title"
        | "company"
        | "location"
        | "apply_url"
        | "contact"
        | "description"
        | "status"
        | "created_at"
      >
    >();

  if (!job) {
    redirect(
      `/jobs?error=${encodeURIComponent("That posting no longer exists.")}`,
    );
  }

  return (
    <AppShell active="jobs" user={viewer}>
      <PageHeader eyebrow="Admin" title="Edit posting" />

      <div className="flex items-center justify-between">
        <Link
          href="/jobs"
          className="text-sm text-ink-2 underline-offset-4 hover:text-brand-700 hover:underline"
        >
          ← Back to jobs
        </Link>
        <JobStatusPill status={job.status} />
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <form action={updateJob} className="flex flex-col gap-3">
        <Section label="Edit posting" index={1}>
          <input type="hidden" name="id" value={job.id} />
          <JobFields defaults={job} />
          <div className="flex justify-end pt-2">
            <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
          </div>
        </Section>
      </form>

      <Section label="Danger zone" index={2}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-2">
            Deleting removes this posting for everyone. This can&apos;t be
            undone.
          </p>
          <form action={deleteJob}>
            <input type="hidden" name="id" value={job.id} />
            <SubmitButton
              pendingLabel="Deleting…"
              className="rounded-md border border-red-200 bg-red-50/60 px-5 py-2 text-sm font-medium text-red-800 transition hover:bg-red-50"
            >
              Delete posting
            </SubmitButton>
          </form>
        </div>
      </Section>
    </AppShell>
  );
}
