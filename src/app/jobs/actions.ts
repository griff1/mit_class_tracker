"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  renderJobAlertEmail,
  renderJobPostedEmail,
  sendEmail,
  sendJobEmails,
} from "@/lib/email";
import { JOB_ALERT_FREQUENCIES } from "@/lib/types";
import { safeHttpUrl } from "@/lib/url-safety";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

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

export async function toggleJobFilled(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const id = trimmed(formData.get("id"));
  const filled = trimmed(formData.get("filled")) === "true";
  if (!id) redirect("/jobs");

  // The RPC enforces owner-or-admin + approved<->closed only, returning false
  // on any violation — so a non-owner can't close someone else's listing and
  // a pending/rejected posting can't be flipped live through this path.
  const { data: ok, error } = await supabase.rpc("set_job_closed", {
    p_id: id,
    p_closed: filled,
  });
  if (error || !ok) {
    redirect(
      `/jobs?error=${encodeURIComponent(
        error?.message ?? "Couldn't update that listing.",
      )}`,
    );
  }

  revalidatePath("/jobs");
  redirect(`/jobs?${filled ? "filled" : "reopened"}=1`);
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
    .select("id, title, company, location, description");

  if (error || !updated?.length) {
    redirect(
      `/jobs/review?error=${encodeURIComponent(
        error?.message ?? "Posting not found — it may have been deleted.",
      )}`,
    );
  }

  // On approval, fan out instant alerts to opted-in members. Best-effort and
  // post-response (after()), so approval UX is never blocked on Resend.
  if (decision === "approve") {
    await dispatchInstantAlerts(supabase, updated[0]);
  }

  revalidatePath("/jobs");
  revalidatePath("/jobs/review");
  redirect(`/jobs/review?done=${decision}`);
}

async function dispatchInstantAlerts(
  supabase: ServerClient,
  job: {
    title: string;
    company: string;
    location: string | null;
    description: string;
  },
) {
  // instant_job_subscribers() is admin-gated and returns each subscriber's
  // unsubscribe token (the token table is API-unreachable). reviewJob runs in
  // the admin session, so this returns the list.
  const { data: subs } = await supabase.rpc("instant_job_subscribers");
  const list = (subs ?? []) as { email: string; token: string }[];
  if (list.length === 0) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const excerpt =
    job.description.length > 300
      ? `${job.description.slice(0, 300)}…`
      : job.description;

  const messages = list
    .filter((s) => !!s.email && !!s.token)
    .map((s) => {
      const unsubscribeUrl = `${siteUrl}/api/jobs/unsubscribe?token=${encodeURIComponent(s.token)}`;
      const { subject, text, html } = renderJobPostedEmail({
        title: job.title,
        company: job.company,
        location: job.location,
        excerpt,
        jobsUrl: `${siteUrl}/jobs`,
        unsubscribeUrl,
      });
      return { to: s.email, subject, text, html, unsubscribeUrl };
    });

  after(async () => {
    try {
      await sendJobEmails(messages);
    } catch {
      // Swallowed: the posting is live regardless of alert delivery.
    }
  });
}

export async function setJobAlerts(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const raw = trimmed(formData.get("frequency"));
  const frequency = (JOB_ALERT_FREQUENCIES as readonly string[]).includes(raw)
    ? raw
    : "off";

  const { error } = await supabase
    .from("profiles")
    .update({ job_alert_frequency: frequency })
    .eq("id", user.id);
  if (error) redirect(`/jobs?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/jobs");
  redirect("/jobs?alerts=saved");
}
