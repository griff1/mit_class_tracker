"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { renderJobAlertEmail, sendEmail } from "@/lib/email";
import { safeHttpUrl } from "@/lib/url-safety";

/**
 * Where new-posting alerts go. The review queue itself (/jobs/review, RLS
 * shows the admin all pending rows) is the source of truth -- the email is a
 * convenience nudge, which is why a send failure does not fail the submission.
 */
const ALERT_TO = process.env.JOBS_ALERT_EMAIL ?? "griff.potrock@gmail.com";

const MAX_SHORT = 120;
const MAX_DESCRIPTION = 5000;

function trimmed(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function submitJob(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const fail = (msg: string) =>
    redirect(`/jobs?error=${encodeURIComponent(msg)}`);

  const title = trimmed(formData.get("title")).slice(0, MAX_SHORT);
  const company = trimmed(formData.get("company")).slice(0, MAX_SHORT);
  const location = trimmed(formData.get("location")).slice(0, MAX_SHORT);
  const contact = trimmed(formData.get("contact")).slice(0, MAX_SHORT);
  const description = trimmed(formData.get("description")).slice(
    0,
    MAX_DESCRIPTION,
  );
  // Same render-and-store guard as LinkedIn URLs: a bad link becomes null
  // rather than a stored javascript:/lookalike href.
  const applyUrl = safeHttpUrl(trimmed(formData.get("apply_url")) || null);

  if (!title) fail("Add a job title.");
  if (!company) fail("Add the company name.");
  if (!description)
    fail("Add a description — that's what your classmates will read.");

  const { error: insertError } = await supabase.from("job_postings").insert({
    posted_by: user.id,
    title,
    company,
    location: location || null,
    apply_url: applyUrl,
    contact: contact || null,
    description,
  });
  if (insertError) fail(`Could not save the posting: ${insertError.message}`);

  // Alert the reviewer. Best-effort: the posting is already safely in the
  // pending queue, so a Resend hiccup should not bounce the member's
  // submission -- the review page lists it regardless.
  try {
    const { data: me } = await supabase
      .from("profiles")
      .select("name, mit_email")
      .eq("id", user.id)
      .maybeSingle<{ name: string | null; mit_email: string }>();
    const posterName = me?.name?.trim() || me?.mit_email || "A member";
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const { subject, text, html } = renderJobAlertEmail({
      posterName,
      title,
      company,
      excerpt:
        description.length > 300
          ? `${description.slice(0, 300)}…`
          : description,
      reviewUrl: `${siteUrl}/jobs/review`,
    });
    await sendEmail({ to: ALERT_TO, subject, text, html });
  } catch {
    // Swallowed deliberately; see note above.
  }

  revalidatePath("/jobs");
  redirect("/jobs?submitted=1");
}

export async function updateJob(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // RLS already restricts UPDATE to admins; check explicitly so a non-admin
  // gets a redirect rather than a silent 0-row no-op.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/jobs");

  const id = trimmed(formData.get("id"));
  if (!id) redirect("/jobs");
  const failEdit = (msg: string) =>
    redirect(`/jobs/${id}/edit?error=${encodeURIComponent(msg)}`);

  const title = trimmed(formData.get("title")).slice(0, MAX_SHORT);
  const company = trimmed(formData.get("company")).slice(0, MAX_SHORT);
  const location = trimmed(formData.get("location")).slice(0, MAX_SHORT);
  const contact = trimmed(formData.get("contact")).slice(0, MAX_SHORT);
  const description = trimmed(formData.get("description")).slice(
    0,
    MAX_DESCRIPTION,
  );
  const applyUrl = safeHttpUrl(trimmed(formData.get("apply_url")) || null);

  if (!title) failEdit("Add a job title.");
  if (!company) failEdit("Add the company name.");
  if (!description) failEdit("Add a description.");

  // Note: status is intentionally untouched — editing an approved posting
  // keeps it live; editing a pending one keeps it pending.
  const { data: updated, error } = await supabase
    .from("job_postings")
    .update({
      title,
      company,
      location: location || null,
      apply_url: applyUrl,
      contact: contact || null,
      description,
    })
    .eq("id", id)
    .select("id");
  if (error || !updated?.length) {
    failEdit(error?.message ?? "Posting not found — it may have been deleted.");
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}/edit`);
  redirect("/jobs?updated=1");
}

export async function deleteJob(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // RLS permits delete on own-or-admin rows; this admin management action is
  // gated to admins (a poster deleting their own is a separate, unused path).
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/jobs");

  const id = trimmed(formData.get("id"));
  if (!id) redirect("/jobs");

  const { error } = await supabase.from("job_postings").delete().eq("id", id);
  if (error) {
    redirect(`/jobs/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/jobs");
  redirect("/jobs?deleted=1");
}

export async function reviewJob(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // RLS already blocks non-admin updates (0 rows), but check explicitly so a
  // non-admin gets a redirect instead of a confusing silent no-op.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/jobs");

  const id = trimmed(formData.get("id"));
  const decision = trimmed(formData.get("decision"));
  if (!id || (decision !== "approve" && decision !== "reject")) {
    redirect("/jobs/review");
  }

  const { data: updated, error } = await supabase
    .from("job_postings")
    .update({
      status: decision === "approve" ? "approved" : "rejected",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");

  if (error || !updated?.length) {
    redirect(
      `/jobs/review?error=${encodeURIComponent(
        error?.message ?? "Posting not found — it may have been deleted.",
      )}`,
    );
  }

  revalidatePath("/jobs");
  revalidatePath("/jobs/review");
  redirect(`/jobs/review?done=${decision}`);
}
