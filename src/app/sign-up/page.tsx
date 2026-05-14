import Link from "next/link";
import { signUp } from "@/app/auth/actions";
import { FieldRow } from "@/components/field-row";
import { Input } from "@/components/inputs";

export default async function SignUpPage({
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
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Check your email</h1>
        <p className="text-ink-2">
          We just sent a confirmation link to your MIT email. Open it to finish signing up.
        </p>
        <p className="text-sm text-ink-3">
          Didn&apos;t get it? Check spam, or{" "}
          <Link href="/sign-up" className="font-medium text-brand-700 underline-offset-4 hover:underline">
            try again
          </Link>
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
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Sign up</h1>
        <p className="text-sm text-ink-2">
          Restricted to <code className="font-mono">@mit.edu</code> email addresses. You&apos;ll
          confirm your email before signing in.
        </p>
      </header>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <form action={signUp} className="rounded-md border border-line bg-paper px-5 py-4">
        <FieldRow label="MIT email">
          <Input
            name="email"
            type="email"
            required
            placeholder="you@mit.edu"
            pattern="^[^@\s]+@mit\.edu$"
            title="Must be an @mit.edu address"
          />
        </FieldRow>
        <FieldRow label="Password">
          <Input name="password" type="password" required minLength={8} />
        </FieldRow>
        <div className="mt-4 flex justify-end border-t border-line pt-3">
          <button
            type="submit"
            className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-cream transition hover:bg-ink-2"
          >
            Sign up
          </button>
        </div>
      </form>
      <p className="text-sm text-ink-2">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-brand-700 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
