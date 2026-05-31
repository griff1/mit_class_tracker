import { cookies } from "next/headers";
import { requestLoginCode, verifyEmailOtp } from "@/app/auth/actions";
import { FieldRow } from "@/components/field-row";
import { Input } from "@/components/inputs";
import { createClient } from "@/lib/supabase/server";

// Must match REF_COOKIE in src/app/auth/actions.ts. Only read here -- this
// page never sets it.
const REF_COOKIE = "sloanopedia_ref";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    step?: string;
    email?: string;
    ref?: string;
  }>;
}) {
  const { error, step, email, ref } = await searchParams;
  const showVerify = step === "verify" && !!email;

  // Look up the inviter's display name when we have a referral code.
  // URL param wins for the initial visit (?ref=…). After the form submits
  // the code lives in the cookie (requestLoginCode strips ref from the
  // redirect URL), so the verify step reads it from there. Failure is
  // silent -- a stale/unknown code just hides the banner.
  const codeForLookup =
    ref?.trim() || (await cookies()).get(REF_COOKIE)?.value || null;
  let inviter: string | null = null;
  if (codeForLookup) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.rpc("referrer_name_for_code", {
        p_code: codeForLookup,
      });
      inviter = typeof data === "string" && data.length > 0 ? data : null;
    } catch {
      // Treat as no inviter; never block sign-in.
    }
  }

  if (showVerify) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-8">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-brand-700">
            MIT Sloan Class of 2026
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            Enter your code
          </h1>
          <p className="text-sm text-ink-2">
            We emailed a 6-digit code to{" "}
            <span className="font-medium text-ink">{email}</span>. It expires in
            an hour.
          </p>
        </header>
        {inviter && <InviteBanner inviter={inviter} />}
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <form
          action={verifyEmailOtp}
          className="rounded-md border border-line bg-paper px-5 py-4"
        >
          <input type="hidden" name="email" value={email} />
          <FieldRow label="6-digit code">
            <Input
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              placeholder="123456"
              aria-label="6-digit code"
            />
          </FieldRow>
          <div className="mt-4 flex justify-end border-t border-line pt-3">
            <button
              type="submit"
              className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-cream transition hover:bg-ink-2"
            >
              Sign in
            </button>
          </div>
        </form>
        <div className="text-sm text-ink-3">
          Didn&apos;t get it? Check spam, or{" "}
          <form action={requestLoginCode} className="inline">
            <input type="hidden" name="email" value={email} />
            <button
              type="submit"
              className="font-medium text-brand-700 underline-offset-4 hover:underline"
            >
              send a new code
            </button>
          </form>
          . Wrong address?{" "}
          <a
            href="/sign-in"
            className="font-medium text-brand-700 underline-offset-4 hover:underline"
          >
            start over
          </a>
          .
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-brand-700">
          MIT Sloan Class of 2026
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Sign in
        </h1>
        <p className="text-sm text-ink-2">
          We&apos;ll email you a 6-digit sign-in code. New accounts: use your{" "}
          <code className="font-mono">@mit.edu</code>,{" "}
          <code className="font-mono">@sloan.mit.edu</code>, or{" "}
          <code className="font-mono">@alum.mit.edu</code> address. Returning
          alumni: use whichever address you sign in with now.
        </p>
      </header>
      {inviter && <InviteBanner inviter={inviter} />}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <form
        action={requestLoginCode}
        className="rounded-md border border-line bg-paper px-5 py-4"
      >
        {ref && <input type="hidden" name="ref" value={ref} />}
        <FieldRow label="Email">
          <Input
            name="email"
            type="email"
            required
            placeholder="you@mit.edu"
            autoComplete="email"
            defaultValue={email ?? ""}
          />
        </FieldRow>
        <div className="mt-4 flex justify-end border-t border-line pt-3">
          <button
            type="submit"
            className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-cream transition hover:bg-ink-2"
          >
            Email me a code
          </button>
        </div>
      </form>
    </main>
  );
}

function InviteBanner({ inviter }: { inviter: string }) {
  return (
    <p className="rounded-md border border-brand-100 bg-brand-50/60 px-3 py-2 text-sm text-ink">
      <span className="font-medium">{inviter}</span> is inviting you to join
      Sloanopedia.
    </p>
  );
}
