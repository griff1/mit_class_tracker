import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Constrain `next` to same-origin paths only. `new URL("https://evil", base)`
 * silently drops the base when the first arg is absolute, so without this
 * check a crafted email link could redirect a freshly-confirmed user to an
 * attacker-controlled domain.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/"; // protocol-relative URL
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  let type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  // Some email templates render an empty `type` (e.g. `{{ .EmailActionType }}`
  // is not populated in the Magic Link template on every Supabase project).
  // For a token_hash link, `email` verifies both magic-link and signup
  // tokens. Email-change links MUST send `type=email_change` explicitly from
  // their own template — that one can't be safely inferred here.
  if (token_hash && !type) {
    console.warn(
      "[auth/confirm] token_hash present but `type` is empty — defaulting to " +
        "'email'. Hardcode &type=email (or &type=email_change for the Change " +
        "Email template) in the Supabase email template.",
    );
    type = "email";
  }

  const supabase = await createClient();

  // PKCE flow — used by Supabase's default ConfirmationURL after it hits
  // /auth/v1/verify and bounces back to us.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    console.error(
      "[auth/confirm] exchangeCodeForSession failed:",
      error.message,
    );
  }

  // Token-hash flow — used when the email template is customized to point
  // directly here (skipping Supabase's verify endpoint round-trip).
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    console.error("[auth/confirm] verifyOtp failed:", error.message);
  }

  if (!code && !token_hash) {
    console.error(
      "[auth/confirm] no code or token_hash in callback — params present:",
      Array.from(searchParams.keys()).join(", ") || "(none)",
    );
  }

  return NextResponse.redirect(
    new URL(
      `/sign-in?error=${encodeURIComponent("Confirmation link is invalid or expired.")}`,
      request.url,
    ),
  );
}
