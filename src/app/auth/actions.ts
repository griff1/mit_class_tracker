"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Sign-in is a 6-digit emailed code, NOT a magic link. Every user is on MIT
// Microsoft 365, whose Safe Links scanner pre-fetches inbound URLs and consumes
// the single-use token before the human clicks. A typed code has no URL to
// pre-fetch. The Supabase "Magic Link" email template MUST render only
// `{{ .Token }}` and contain NO confirmation URL — the code and the link share
// one OTP, so a prefetched link would burn the code too. See CLAUDE.md.

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
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

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
