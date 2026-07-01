import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { reviewJob } from "../actions";
import { JOB_SELECT, JobCard, type JobRow } from "../job-card";

/**
 * Admin-only review queue. RLS is the real gate (non-admins can neither see
 * pending rows nor update status); the redirect here is just UX so a curious
 * member gets bounced to /jobs instead of an empty page.
 */
export default async function JobsReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { done, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/jobs");

  const viewer = await getViewer(supabase, user);

  // Oldest first — review in submission order.
  const { data: pending, error: fetchError } = await supabase
    .from("job_postings")
    .select(JOB_SELECT)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .returns<JobRow[]>();

  return (
    <AppShell active="jobs" user={viewer}>
      <PageHeader
        eyebrow="Admin"
        title="Review postings"
        count={pending ? `${pending.length} pending` : "—"}
      />

      {done && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800">
          {done === "approve"
            ? "Approved — it's live on the jobs feed."
            : "Rejected — the poster sees “Not approved” on their submissions list."}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {fetchError && (
        <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
          Couldn&apos;t load the queue: {fetchError.message}
        </p>
      )}

      {pending && pending.length === 0 && !fetchError && (
        <p className="rounded-md border border-line bg-paper px-4 py-8 text-center text-sm text-ink-3">
          Queue is clear — nothing waiting for review.
        </p>
      )}

      {pending && pending.length > 0 && (
        <ul className="flex flex-col gap-4">
          {pending.map((j) => (
            <li key={j.id} className="flex flex-col gap-0">
              <ul>
                <JobCard job={j} />
              </ul>
              <div className="-mt-px flex items-center justify-end gap-2 rounded-b-md border border-line bg-cream/60 px-4 py-2.5">
                <form action={reviewJob}>
                  <input type="hidden" name="id" value={j.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <SubmitButton
                    pendingLabel="Rejecting…"
                    className="rounded-md border border-red-200 bg-red-50/60 px-5 py-2 text-sm font-medium text-red-800 transition hover:bg-red-50"
                  >
                    Reject
                  </SubmitButton>
                </form>
                <form action={reviewJob}>
                  <input type="hidden" name="id" value={j.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <SubmitButton pendingLabel="Approving…">Approve</SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
