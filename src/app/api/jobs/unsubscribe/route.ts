import { createClient } from "@/lib/supabase/server";

/**
 * One-click unsubscribe for the job mailing list. The `token` is an unguessable
 * per-member value (from the email's List-Unsubscribe URL); the SECURITY
 * DEFINER `unsubscribe_job_alerts` RPC flips that member's job_alert_frequency
 * to 'off'. No login required — the token is the credential — and no other
 * account can be affected because tokens aren't enumerable or member-readable.
 *
 * POST is the RFC 8058 one-click path (Gmail/Outlook POST the header URL); GET
 * serves the human-visible link in the email body with a confirmation page.
 */
async function applyUnsubscribe(request: Request): Promise<boolean> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("unsubscribe_job_alerts", {
    p_token: token,
  });
  return data === true;
}

export async function POST(request: Request) {
  await applyUnsubscribe(request);
  // Always 200 for the one-click POST so the mail client shows success.
  return new Response(null, { status: 200 });
}

export async function GET(request: Request) {
  const ok = await applyUnsubscribe(request);
  const body = ok
    ? {
        title: "Unsubscribed",
        message:
          "You won't receive job-posting emails from Sloanopedia anymore. You can turn them back on anytime from the Jobs page.",
      }
    : {
        title: "Link expired",
        message:
          "We couldn't process that unsubscribe link. Open Sloanopedia and set your job alerts to Off on the Jobs page.",
      };

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${body.title} — Sloanopedia</title>
<style>
  body { margin:0; background:#f5ecda; color:#1f1814; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  .wrap { max-width:480px; margin:0 auto; padding:48px 20px; }
  .card { background:#fff; border:1px solid #d2c19a; border-radius:6px; padding:32px; }
  .eyebrow { font-family:'SFMono-Regular',Consolas,Menlo,monospace; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:#e85d45; margin:0 0 12px; }
  h1 { font-size:22px; font-weight:600; letter-spacing:-0.01em; margin:0 0 12px; }
  p { font-size:15px; line-height:1.5; color:#5b4f44; margin:0 0 16px; }
  a { color:#a23420; font-weight:600; text-decoration:none; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <p class="eyebrow">Sloanopedia jobs</p>
      <h1>${body.title}</h1>
      <p>${body.message}</p>
      <a href="/jobs">Go to the Jobs page &rarr;</a>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
