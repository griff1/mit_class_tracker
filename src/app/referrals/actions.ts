"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { escapeHtml, sendEmail } from "@/lib/email";
import { generateReferralCode } from "@/lib/referral-code";
import { safeEmail } from "@/lib/url-safety";

/**
 * The MIT-domain gate at signup (see Auth Hook) accepts these three suffixes.
 * Referrals are restricted to the same set -- there is no point inviting a
 * non-MIT address since the hook would reject the eventual signup anyway.
 */
const MIT_SUFFIXES = ["@mit.edu", "@sloan.mit.edu", "@alum.mit.edu"] as const;

function isMitDomain(email: string): boolean {
  const lower = email.toLowerCase();
  return MIT_SUFFIXES.some((s) => lower.endsWith(s));
}

export async function sendReferral(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const raw =
    typeof formData.get("email") === "string"
      ? (formData.get("email") as string)
      : "";
  const normalized = safeEmail(raw)?.toLowerCase() ?? null;

  const fail = (msg: string) =>
    redirect(`/referrals?error=${encodeURIComponent(msg)}`);

  if (!normalized) fail("Enter a valid email address.");
  if (!isMitDomain(normalized!))
    fail(
      "Invites must go to @mit.edu, @sloan.mit.edu, or @alum.mit.edu addresses.",
    );

  // No self-referrals. Compare against both the current auth email AND
  // the historical mit_email -- a user who has transitioned to a personal
  // email could otherwise invite their own MIT address.
  const { data: me } = await supabase
    .from("profiles")
    .select("name, mit_email, personal_email")
    .eq("id", user.id)
    .maybeSingle<{
      name: string | null;
      mit_email: string;
      personal_email: string | null;
    }>();
  if (!me) fail("Your profile is not loaded yet. Try again in a moment.");

  const ownEmails = new Set(
    [user.email, me!.mit_email].filter(Boolean).map((e) => e!.toLowerCase()),
  );
  if (ownEmails.has(normalized!))
    fail("You cannot refer yourself.");

  // Block invites to people who already joined. The RPC checks
  // profiles.mit_email (only confirmed users have profile rows), so a
  // pending unconfirmed signup will not block (acceptably rare race).
  const { data: alreadyJoined } = await supabase.rpc(
    "is_registered_mit_email",
    { p_email: normalized },
  );
  if (alreadyJoined) fail("That person already joined Sloanopedia.");

  // Insert the referral. The UNIQUE(referrer_id, lower(referred_email))
  // index handles the "one referrer, one email" anti-spam rule -- a
  // duplicate insert raises 23505 and we surface a clear message.
  const code = generateReferralCode();
  const { error: insertError } = await supabase.from("referrals").insert({
    referrer_id: user.id,
    referred_email: normalized,
    referral_code: code,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      fail("You already invited that person.");
    }
    fail(`Could not save referral: ${insertError.message}`);
  }

  // Build the invite URL. Email pre-fills the sign-in form; ref is the
  // load-bearing piece for credit -- verifyEmailOtp redeems whichever
  // code was used (cookie set in requestLoginCode), so if A and B both
  // invite X only the link X actually clicked gets credit.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const referralUrl =
    `${siteUrl}/sign-in?email=${encodeURIComponent(normalized!)}` +
    `&ref=${encodeURIComponent(code)}`;

  const referrerName =
    me!.name?.trim() || me!.mit_email || "A classmate";
  const subject = `${referrerName} invited you to Sloanopedia`;
  const text = [
    `Hi,`,
    ``,
    `${referrerName} invited you to join Sloanopedia, the private directory for the MIT Sloan Class of 2026.`,
    ``,
    `Sign in here to claim your profile:`,
    referralUrl,
    ``,
    `Sloanopedia is class-members-only. You will get a 6-digit access code emailed to your @mit.edu, @sloan.mit.edu, or @alum.mit.edu address.`,
  ].join("\n");
  const html = [
    `<p>Hi,</p>`,
    `<p><strong>${escapeHtml(referrerName)}</strong> invited you to join <a href="${siteUrl}">Sloanopedia</a>, the private directory for the MIT Sloan Class of 2026.</p>`,
    `<p><a href="${referralUrl}">Sign in here to claim your profile</a>.</p>`,
    `<p style="color:#5b4f44;font-size:13px">Sloanopedia is class-members-only. You will get a 6-digit access code emailed to your @mit.edu, @sloan.mit.edu, or @alum.mit.edu address.</p>`,
  ].join("");

  // Send via Resend. If the API call fails AFTER the DB insert, the row
  // exists but no email went out -- the user sees the error and can use
  // the "Resend" path (deferred for v1) to retry. We do NOT rollback the
  // row, because resending is exactly the path we want for the rare
  // transient failure; rolling back would require manual cleanup.
  try {
    await sendEmail({
      to: normalized!,
      subject,
      text,
      html,
      replyTo: me!.personal_email ?? undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    fail(`Saved referral but email failed: ${msg}`);
  }

  revalidatePath("/referrals");
  redirect(`/referrals?sent=${encodeURIComponent(normalized!)}`);
}
