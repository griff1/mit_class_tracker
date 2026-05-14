"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MIT_DOMAIN = "@mit.edu";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");

  // First line of domain enforcement. The auth hook in the DB is the second.
  if (!email.endsWith(MIT_DOMAIN)) {
    redirect(
      `/sign-up?error=${encodeURIComponent("Sign-up is restricted to @mit.edu email addresses.")}`,
    );
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl}/auth/confirm` },
  });

  if (error) {
    redirect(`/sign-up?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/sign-up?check=email");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
