import { requestMagicLink } from "@/app/auth/actions";
import { FieldRow } from "@/components/field-row";
import { Input } from "@/components/inputs";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; check?: string }>;
}) {
  const { error, check } = await searchParams;

  if (check === "email") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-8">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-brand-700">
          MIT Sloan Class of 2026
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Check your email
        </h1>
        <p className="text-ink-2">
          We just sent you a sign-in link. Open it on this device to finish.
        </p>
        <p className="text-sm text-ink-3">
          Didn&apos;t get it? Check spam, or{" "}
          <a
            href="/sign-in"
            className="font-medium text-brand-700 underline-offset-4 hover:underline"
          >
            try again
          </a>
          .
        </p>
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
          We&apos;ll email you a sign-in link. New accounts: use your{" "}
          <code className="font-mono">@mit.edu</code> or{" "}
          <code className="font-mono">@alum.mit.edu</code> address. Returning
          alumni: use whichever address you sign in with now.
        </p>
      </header>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <form
        action={requestMagicLink}
        className="rounded-md border border-line bg-paper px-5 py-4"
      >
        <FieldRow label="Email">
          <Input
            name="email"
            type="email"
            required
            placeholder="you@mit.edu"
            autoComplete="email"
            pattern="[^@\s]+@(alum\.)?mit\.edu"
            title="Use your @mit.edu or @alum.mit.edu email address"
          />
        </FieldRow>
        <div className="mt-4 flex justify-end border-t border-line pt-3">
          <button
            type="submit"
            className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-cream transition hover:bg-ink-2"
          >
            Send sign-in link
          </button>
        </div>
      </form>
    </main>
  );
}
