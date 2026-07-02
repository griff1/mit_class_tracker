import { createClient } from "@/lib/supabase/server";
import { renderJobDigestEmail, sendJobEmails } from "@/lib/email";

/**
 * Weekly job digest, invoked by Vercel Cron (see vercel.json).
 *
 * Auth: when CRON_SECRET is set in env, Vercel attaches
 * `Authorization: Bearer ${CRON_SECRET}` to cron requests. We verify it, then
 * pass the SAME secret to the job_digest_batch RPC, which is gated on it (the
 * RPC is anon-callable but returns nothing without the secret, so member emails
 * never leak). No service-role key is involved — the route runs with no user
 * session and every read goes through the secret-gated RPC.
 *
 * The Monday (UTC) guard keeps delivery weekly even if the platform
 * approximates the cron schedule to daily (Hobby plan), so subscribers don't
 * get overlapping 7-day digests every day.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("CRON_SECRET not configured", { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (new Date().getUTCDay() !== 1) {
    return Response.json({ ok: true, skipped: "not monday (utc)" });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("job_digest_batch", {
    p_secret: secret,
  });
  if (error) {
    return new Response(`RPC error: ${error.message}`, { status: 500 });
  }

  const payload = data as {
    ok: boolean;
    recipients?: { email: string; token: string }[];
    jobs?: { title: string; company: string; location: string | null }[];
  } | null;
  if (!payload?.ok) {
    // CRON_SECRET and the app_secrets 'job_digest' row don't match.
    return new Response("Digest secret rejected", { status: 401 });
  }

  const recipients = (payload.recipients ?? []).filter(
    (r) => !!r.email && !!r.token,
  );
  const jobs = payload.jobs ?? [];
  if (recipients.length === 0 || jobs.length === 0) {
    return Response.json({
      ok: true,
      sent: 0,
      recipients: recipients.length,
      jobs: jobs.length,
    });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const jobsUrl = `${siteUrl}/jobs`;
  const messages = recipients.map((r) => {
    const unsubscribeUrl = `${siteUrl}/api/jobs/unsubscribe?token=${encodeURIComponent(r.token)}`;
    const { subject, text, html } = renderJobDigestEmail({
      jobs,
      jobsUrl,
      unsubscribeUrl,
    });
    return { to: r.email, subject, text, html, unsubscribeUrl };
  });
  await sendJobEmails(messages);

  return Response.json({ ok: true, sent: messages.length, jobs: jobs.length });
}
