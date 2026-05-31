"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { renderReferralEmail, sendEmail } from "@/lib/email";
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

  // Build the invite URL. `ref` is the only param: it is the load-bearing
  // piece for credit -- verifyEmailOtp redeems whichever code was used
  // (cookie set in requestLoginCode), so if A and B both invite X only the
  // link X actually clicked gets credit. We deliberately do NOT embed the
  // recipient's email in the query string: a long URL carrying an address
  // is a phishing/tracking fingerprint that hurts deliverability (esp. into
  // MIT's Microsoft 365), and having the recipient type their own address
  // is marginally safer anyway.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const referralUrl = `${siteUrl}/sign-in?ref=${encodeURIComponent(code)}`;

  const referrerName = me!.name?.trim() || me!.mit_email || "A classmate";

  // Greeting name: the referrer optionally types it (they know the person).
  // We deliberately do NOT guess from the email -- most MIT addresses are
  // Kerberos IDs (e.g. "rcheeti") with no recoverable first name, and a wrong
  // guess in an invite reads worse than the neutral "Hi there," fallback that
  // renderReferralEmail applies when this is blank.
  const recipientName =
    typeof formData.get("name") === "string"
      ? (formData.get("name") as string).trim().slice(0, 50) || null
      : null;

  const { subject, text, html } = renderReferralEmail({
    referrerName,
    referralUrl,
    recipientName,
  });

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
