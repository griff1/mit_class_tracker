"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Sign-in/sign-up is a 6-digit emailed code, NOT a magic link. Every user is
// on MIT Microsoft 365, whose Safe Links scanner pre-fetches inbound URLs and
// consumes the single-use token before the human clicks; a typed code has no
// URL to pre-fetch. signInWithOtp sends DIFFERENT templates depending on the
// user: returning users get "Magic Link", brand-new signups (Confirm email is
// on) get "Confirm signup". BOTH Supabase templates MUST render only
// `{{ .Token }}` with NO confirmation URL — the link and the code share one
// OTP, so a prefetched link burns the code too. Correspondingly, the code
// verifies as type 'email' for returning users and 'signup' for new signups,
// so verifyEmailOtp tries both. See CLAUDE.md.

export async function requestLoginCode(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();

  if (!email) {
    redirect(`/sign-in?error=${encodeURIComponent("Email is required.")}`);
  }

  // No app-side domain check by design: the before_user_created hook is the
  // sole gate (it also covers direct REST signups an app check never could),
  // and its rejection message is surfaced to the user via the error redirect
  // below. Pre-deploy, the hook is verified by supabase/health-check.sql.
  const supabase = await createClient();

  // Catch the "stranded MIT email" case before any signup email goes out: if
  // someone signed up with alice@mit.edu and later moved their sign-in to
  // alice@gmail.com, typing alice@mit.edu here would otherwise trigger a
  // brand-new signup that fails at verifyOtp (the on_auth_user_confirmed
  // trigger trips profiles.mit_email UNIQUE), surfaced as a useless
  // "invalid code". See is_replaced_mit_email migration for full rationale.
  const { data: isReplaced } = await supabase.rpc("is_replaced_mit_email", {
    email,
  });
  if (isReplaced) {
    redirect(
      `/sign-in?error=${encodeURIComponent(
        "This MIT email is no longer your sign-in address — use the personal email you set on your profile. If you've also lost access to that, contact an admin.",
      )}`,
    );
  }

  // signInWithOtp covers both sign-up and sign-in (shouldCreateUser defaults
  // to true): a new email creates auth.users (gated by the before_user_created
  // hook); an existing user gets a code to whatever auth.users.email currently
  // is (may differ from their MIT email post alumni transition).
  const { error } = await supabase.auth.signInWithOtp({ email });

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/sign-in?step=verify&email=${encodeURIComponent(email)}`);
}

export async function verifyEmailOtp(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const token = String(formData.get("token") ?? "").replace(/\s+/g, "");

  const back = (message: string) =>
    redirect(
      `/sign-in?step=verify&email=${encodeURIComponent(
        email,
      )}&error=${encodeURIComponent(message)}`,
    );

  if (!email) {
    redirect(`/sign-in?error=${encodeURIComponent("Email is required.")}`);
  }
  if (!token) {
    back("Enter the 6-digit code from your email.");
  }

  const supabase = await createClient();
  // The same code box handles two GoTrue token classes: returning sign-ins
  // (magic-link OTP → type 'email') and brand-new signups when "Confirm email"
  // is on (signup-confirmation OTP → type 'signup'). We can't tell which the
  // user pasted, so try 'email' then fall back to 'signup'. A failed verify
  // does not consume the token and attempts are GoTrue-rate-limited.
  let { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    ({ error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    }));
  }

  if (error) {
    back("That code is invalid or expired. Request a new one.");
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
