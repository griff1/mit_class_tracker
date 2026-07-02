/**
 * Transactional email via Resend's REST API. Used for referral invites.
 *
 * Why direct REST instead of a SDK: avoids adding `resend` as a runtime
 * dep when we only have one call site. Resend's API is a single POST.
 *
 * Separation of concerns: Supabase Auth emails (sign-in code, email-change
 * confirmation) go through Supabase's SMTP integration (already configured
 * with a Resend key in the Supabase dashboard). This module sends
 * app-originated transactional email (referral invites) using a Resend
 * key the app holds directly. The two keys can be the same or distinct;
 * they just need to be issued from the same verified sending domain.
 *
 * Required env vars:
 *   - RESEND_API_KEY        - Resend API key with sending scope
 *   - REFERRAL_EMAIL_FROM   - "From" address, e.g.
 *                             "Sloanopedia <referrals@sloanopedia.com>"
 *                             (defaults below if unset)
 */

const DEFAULT_FROM = "Sloanopedia <referrals@sloanopedia.com>";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Optional Reply-To, e.g. the referrer's personal_email so the recipient can reply directly. */
  replyTo?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured. Set it in Vercel env to enable referral emails.",
    );
  }
  const from = process.env.REFERRAL_EMAIL_FROM ?? DEFAULT_FROM;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    // Surface the Resend error body to the caller so the Server Action
    // can render something specific (rate limit, unverified domain, etc.).
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  }
}

/**
 * Broadcast one email to many recipients via BCC, chunked so no single message
 * exceeds Resend's per-message recipient cap. Recipients are hidden from each
 * other (bcc). `to` is set to the From address (Resend requires a `to`). Used
 * for the job mailing list (instant + weekly digest). Deduped, case-folded.
 */
export async function sendBroadcast(
  recipients: string[],
  subject: string,
  text: string,
  html: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured. Set it in Vercel env to enable job emails.",
    );
  }
  const from = process.env.REFERRAL_EMAIL_FROM ?? DEFAULT_FROM;
  const unique = Array.from(
    new Set(recipients.map((r) => r.trim().toLowerCase()).filter(Boolean)),
  );
  const CHUNK = 45; // stay under Resend's 50-recipient-per-message limit
  for (let i = 0; i < unique.length; i += CHUNK) {
    const bcc = unique.slice(i, i + CHUNK);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [from], bcc, subject, text, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
    }
  }
}

/** Basic HTML escape for interpolating untrusted strings into our email templates. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Brand palette for emails. Mirrors the app's design tokens
 * (src/app/globals.css): warm cream/paper surfaces, warm-dark "ink" text,
 * a single coral accent. Hex only -- email clients (especially MIT's
 * Outlook/Microsoft 365, which every recipient is on) don't support the
 * oklch() the app uses, so these are the sRGB equivalents.
 */
const EMAIL = {
  cream: "#f5ecda", // page background (--color-cream)
  paper: "#ffffff", // card surface (--color-paper)
  ink: "#1f1814", // primary text / headings (--color-ink)
  ink2: "#5b4f44", // body text (--color-ink-2)
  ink3: "#8a7b6b", // tertiary / footnotes (--color-ink-3)
  line: "#d2c19a", // hairline rules (--color-line)
  coral: "#e85d45", // brand accent / eyebrow (--color-brand-500)
  coralDark: "#a23420", // links on light bg (--color-brand-700)
} as const;

// Web-safe font stacks. The app uses Geist + JetBrains Mono, which won't
// load in mail clients, so fall back to the platform system stacks while
// keeping the same sans/mono split that makes the UI feel "documented".
const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO =
  "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,Courier,monospace";

export type JobAlertEmailInput = {
  /** Poster's display name (escaped before rendering). */
  posterName: string;
  /** Posting title / company (escaped). */
  title: string;
  company: string;
  /** First ~300 chars of the description (escaped). */
  excerpt: string;
  /** Absolute URL of the review page. */
  reviewUrl: string;
};

/**
 * Admin alert for a newly submitted job posting awaiting review. Same
 * Outlook-safe, brand-matched construction as the referral invite (table
 * layout, inline styles, bulletproof button).
 */
export function renderJobAlertEmail({
  posterName,
  title,
  company,
  excerpt,
  reviewUrl,
}: JobAlertEmailInput): { subject: string; text: string; html: string } {
  const name = escapeHtml(posterName);
  const t = escapeHtml(title);
  const co = escapeHtml(company);
  const ex = escapeHtml(excerpt);
  const url = escapeHtml(reviewUrl);

  const subject = `Review: ${title} at ${company}`;

  const text = [
    `${posterName} submitted a job posting on Sloanopedia.`,
    ``,
    `${title} — ${company}`,
    ``,
    excerpt,
    ``,
    `Review it here:`,
    reviewUrl,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0; padding:0; background-color:${EMAIL.cream}; -webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL.cream};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:480px; max-width:480px;">
          <tr>
            <td style="background-color:${EMAIL.paper}; border:1px solid ${EMAIL.line}; border-radius:6px; padding:32px;">
              <p style="margin:0 0 14px 0; font-family:${MONO}; font-size:11px; line-height:1; letter-spacing:0.14em; text-transform:uppercase; color:${EMAIL.coral};">
                Sloanopedia admin
              </p>
              <h1 style="margin:0 0 16px 0; font-family:${SANS}; font-size:22px; line-height:1.25; font-weight:600; letter-spacing:-0.01em; color:${EMAIL.ink};">
                New job posting to review
              </h1>
              <p style="margin:0 0 8px 0; font-family:${SANS}; font-size:15px; line-height:1.5; color:${EMAIL.ink2};">
                <strong style="color:${EMAIL.ink};">${name}</strong> submitted:
              </p>
              <p style="margin:0 0 8px 0; font-family:${SANS}; font-size:15px; line-height:1.5; color:${EMAIL.ink};">
                <strong>${t}</strong> &mdash; ${co}
              </p>
              <p style="margin:0 0 8px 0; font-family:${SANS}; font-size:13px; line-height:1.5; color:${EMAIL.ink2};">
                ${ex}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0 0;">
                <tr>
                  <td align="center" bgcolor="${EMAIL.ink}" style="border-radius:6px;">
                    <a href="${url}" target="_blank" style="display:inline-block; padding:12px 24px; font-family:${SANS}; font-size:14px; font-weight:600; line-height:1; color:${EMAIL.cream}; text-decoration:none; border-radius:6px;">
                      Review postings &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

/**
 * Shared card+footer wrapper for the job mailing-list emails. `inner` is the
 * card's inner HTML. The footer explains why they're receiving it and how to
 * turn it off (self-service on the Jobs page) — basic list hygiene.
 */
function jobEmailShell(subject: string, inner: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0; padding:0; background-color:${EMAIL.cream}; -webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL.cream};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:480px; max-width:480px;">
          <tr>
            <td style="background-color:${EMAIL.paper}; border:1px solid ${EMAIL.line}; border-radius:6px; padding:32px;">
${inner}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 8px 0 8px;">
              <p style="margin:0; font-family:${SANS}; font-size:11px; line-height:1.5; color:${EMAIL.ink3};">
                You&rsquo;re getting this because you turned on job alerts in Sloanopedia. Change the frequency or turn it off on the Jobs page.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function jobButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0 0;">
                <tr>
                  <td align="center" bgcolor="${EMAIL.ink}" style="border-radius:6px;">
                    <a href="${url}" target="_blank" style="display:inline-block; padding:12px 24px; font-family:${SANS}; font-size:14px; font-weight:600; line-height:1; color:${EMAIL.cream}; text-decoration:none; border-radius:6px;">
                      ${label}
                    </a>
                  </td>
                </tr>
              </table>`;
}

export type JobPostedEmailInput = {
  title: string;
  company: string;
  location: string | null;
  excerpt: string;
  jobsUrl: string;
};

/** Instant alert: a single newly-approved posting. */
export function renderJobPostedEmail({
  title,
  company,
  location,
  excerpt,
  jobsUrl,
}: JobPostedEmailInput): { subject: string; text: string; html: string } {
  const t = escapeHtml(title);
  const co = escapeHtml(company);
  const loc = location ? escapeHtml(location) : "";
  const ex = escapeHtml(excerpt);
  const url = escapeHtml(jobsUrl);

  const subject = `New job: ${title} at ${company}`;
  const text = [
    `A new job was posted on Sloanopedia.`,
    ``,
    `${title} — ${company}${location ? ` (${location})` : ""}`,
    ``,
    excerpt,
    ``,
    `See it on the jobs board:`,
    jobsUrl,
    ``,
    `Manage your job alerts on the Jobs page.`,
  ].join("\n");

  const inner = `              <p style="margin:0 0 14px 0; font-family:${MONO}; font-size:11px; line-height:1; letter-spacing:0.14em; text-transform:uppercase; color:${EMAIL.coral};">
                Sloanopedia jobs
              </p>
              <h1 style="margin:0 0 16px 0; font-family:${SANS}; font-size:22px; line-height:1.25; font-weight:600; letter-spacing:-0.01em; color:${EMAIL.ink};">
                New job posting
              </h1>
              <p style="margin:0 0 8px 0; font-family:${SANS}; font-size:15px; line-height:1.5; color:${EMAIL.ink};">
                <strong>${t}</strong> <span style="color:${EMAIL.ink2};">— ${co}${loc ? ` (${loc})` : ""}</span>
              </p>
              <p style="margin:0 0 8px 0; font-family:${SANS}; font-size:13px; line-height:1.5; color:${EMAIL.ink2};">
                ${ex}
              </p>
              ${jobButton(url, "View on the jobs board &rarr;")}`;

  return { subject, text, html: jobEmailShell(subject, inner) };
}

export type JobDigestEmailInput = {
  jobs: { title: string; company: string; location: string | null }[];
  jobsUrl: string;
};

/** Weekly digest: the past 7 days of approved postings. */
export function renderJobDigestEmail({
  jobs,
  jobsUrl,
}: JobDigestEmailInput): { subject: string; text: string; html: string } {
  const url = escapeHtml(jobsUrl);
  const count = jobs.length;
  const subject = `${count} new ${count === 1 ? "job" : "jobs"} on Sloanopedia this week`;

  const text = [
    `This week on the Sloanopedia jobs board:`,
    ``,
    ...jobs.map(
      (j) => `• ${j.title} — ${j.company}${j.location ? ` (${j.location})` : ""}`,
    ),
    ``,
    `See them all:`,
    jobsUrl,
    ``,
    `Manage your job alerts on the Jobs page.`,
  ].join("\n");

  const rows = jobs
    .map(
      (j) =>
        `              <p style="margin:0 0 10px 0; font-family:${SANS}; font-size:14px; line-height:1.4; color:${EMAIL.ink};">
                <strong>${escapeHtml(j.title)}</strong> <span style="color:${EMAIL.ink2};">— ${escapeHtml(j.company)}${j.location ? ` (${escapeHtml(j.location)})` : ""}</span>
              </p>`,
    )
    .join("\n");

  const inner = `              <p style="margin:0 0 14px 0; font-family:${MONO}; font-size:11px; line-height:1; letter-spacing:0.14em; text-transform:uppercase; color:${EMAIL.coral};">
                Sloanopedia jobs
              </p>
              <h1 style="margin:0 0 16px 0; font-family:${SANS}; font-size:22px; line-height:1.25; font-weight:600; letter-spacing:-0.01em; color:${EMAIL.ink};">
                This week&rsquo;s new jobs
              </h1>
${rows}
              ${jobButton(url, "View the jobs board &rarr;")}`;

  return { subject, text, html: jobEmailShell(subject, inner) };
}

export type ReferralEmailInput = {
  /** Inviter's display name (already chosen by the caller; will be escaped). */
  referrerName: string;
  /** Full sign-in URL carrying ?ref= (will be escaped for the href + visible link). */
  referralUrl: string;
  /**
   * Recipient's first name for the greeting, if known (typed by the referrer
   * or best-effort parsed from their email). Falls back to a neutral greeting
   * when null/blank. Will be escaped.
   */
  recipientName?: string | null;
};

/**
 * Render the referral-invite email (subject + plaintext + HTML).
 *
 * The HTML is a table-based, inline-styled layout deliberately built for
 * Outlook/Microsoft 365 compatibility (no flexbox, no <style> block, no
 * background images, bulletproof button as a padded bgcolor table cell).
 * Visual language matches the app: coral mono eyebrow, ink headline,
 * ink-on-cream primary button (the app's primary CTA is bg-ink/text-cream,
 * with coral reserved as the accent), hairline divider, mono footnote.
 */
export function renderReferralEmail({
  referrerName,
  referralUrl,
  recipientName,
}: ReferralEmailInput): { subject: string; text: string; html: string } {
  const name = escapeHtml(referrerName);
  const url = escapeHtml(referralUrl);

  const greetName = recipientName?.trim();
  const greeting = greetName ? `Hi ${greetName},` : "Hi there,";
  const greetingHtml = escapeHtml(greeting);

  const subject = `${referrerName} invited you to Sloanopedia`;

  const text = [
    greeting,
    ``,
    `${referrerName} invited you to join Sloanopedia — the private directory for the MIT Sloan Class of 2026.`,
    ``,
    `Claim your profile:`,
    referralUrl,
    ``,
    `Sloanopedia is class-members-only. You'll sign in with a 6-digit code emailed to your @mit.edu, @sloan.mit.edu, or @alum.mit.edu address.`,
    ``,
    `Sent because ${referrerName} entered your address on Sloanopedia.`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0; padding:0; background-color:${EMAIL.cream}; -webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL.cream};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:480px; max-width:480px;">
          <tr>
            <td style="background-color:${EMAIL.paper}; border:1px solid ${EMAIL.line}; border-radius:6px; padding:32px;">
              <p style="margin:0 0 14px 0; font-family:${MONO}; font-size:11px; line-height:1; letter-spacing:0.14em; text-transform:uppercase; color:${EMAIL.coral};">
                MIT Sloan Class of 2026
              </p>
              <h1 style="margin:0 0 16px 0; font-family:${SANS}; font-size:22px; line-height:1.25; font-weight:600; letter-spacing:-0.01em; color:${EMAIL.ink};">
                You&rsquo;re invited to Sloanopedia
              </h1>
              <p style="margin:0 0 12px 0; font-family:${SANS}; font-size:15px; line-height:1.5; color:${EMAIL.ink};">
                ${greetingHtml}
              </p>
              <p style="margin:0 0 8px 0; font-family:${SANS}; font-size:15px; line-height:1.5; color:${EMAIL.ink2};">
                <strong style="color:${EMAIL.ink};">${name}</strong> invited you to join Sloanopedia &mdash; the private directory for the MIT Sloan Class of 2026. Profiles, a class map, and a searchable directory to keep the cohort connected after graduation.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
                <tr>
                  <td align="center" bgcolor="${EMAIL.ink}" style="border-radius:6px;">
                    <a href="${url}" target="_blank" style="display:inline-block; padding:12px 24px; font-family:${SANS}; font-size:14px; font-weight:600; line-height:1; color:${EMAIL.cream}; text-decoration:none; border-radius:6px;">
                      Claim your profile &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px 0; font-family:${SANS}; font-size:12px; line-height:1.5; color:${EMAIL.ink3};">
                Or paste this link into your browser:
              </p>
              <p style="margin:0 0 24px 0; font-family:${MONO}; font-size:12px; line-height:1.5; word-break:break-all;">
                <a href="${url}" target="_blank" style="color:${EMAIL.coralDark}; text-decoration:underline;">${url}</a>
              </p>
              <div style="border-top:1px solid ${EMAIL.line}; font-size:0; line-height:0;">&nbsp;</div>
              <p style="margin:18px 0 0 0; font-family:${MONO}; font-size:11px; line-height:1.6; color:${EMAIL.ink3};">
                Sloanopedia is class-members-only. You&rsquo;ll sign in with a 6-digit code emailed to your @mit.edu, @sloan.mit.edu, or @alum.mit.edu address.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 8px 0 8px;">
              <p style="margin:0; font-family:${SANS}; font-size:11px; line-height:1.5; color:${EMAIL.ink3};">
                Sent because ${name} entered your address on Sloanopedia.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
