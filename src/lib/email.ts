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
    // can render something specific (rate-limited, unverified domain, etc.).
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  }
}

/** Basic HTML escape for interpolating untrusted strings into our minimal email template. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
