"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();

  if (!email) {
    redirect(`/sign-in?error=${encodeURIComponent("Email is required.")}`);
  }

  // App-side domain check. The before_user_created DB hook is the real
  // security boundary (it also stops direct REST signups that skip this
  // form). This is for fast UX feedback — and defense-in-depth so a hook
  // misconfig isn't a total bypass again.
  //
  // CAVEAT: this also blocks an alum who has transitioned their sign-in
  // email to a personal address from requesting a link. No users have
  // transitioned yet (the feature isn't live). Before that ships, this
  // must become "allow if the email already belongs to a known member,
  // else require @mit.edu/@alum.mit.edu".
  if (!/@(alum\.)?mit\.edu$/i.test(email)) {
    redirect(
      `/sign-in?error=${encodeURIComponent(
        "Use your @mit.edu or @alum.mit.edu email address.",
      )}`,
    );
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // signInWithOtp covers both sign-up and sign-in:
  //   - New email → auth.users is created (gated by the before_user_created
  //     hook, which rejects non-@mit.edu addresses with a clear message)
  //   - Existing user → magic link is sent to whatever auth.users.email is
  //     currently set to (which may differ from their original MIT email if
  //     they've gone through the alumni email transition).
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl}/auth/confirm` },
  });

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/sign-in?check=email");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
