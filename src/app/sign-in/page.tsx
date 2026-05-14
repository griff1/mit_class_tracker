import Link from "next/link";
import { signIn } from "@/app/auth/actions";
import { FieldRow } from "@/components/field-row";
import { Input } from "@/components/inputs";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-brand-700">
          MIT Sloan Class of 2026
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Sign in</h1>
      </header>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <form action={signIn} className="rounded-md border border-line bg-paper px-5 py-4">
        <FieldRow label="MIT email">
          <Input name="email" type="email" required placeholder="you@mit.edu" />
        </FieldRow>
        <FieldRow label="Password">
          <Input name="password" type="password" required />
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
      <p className="text-sm text-ink-2">
        No account yet?{" "}
        <Link href="/sign-up" className="font-medium text-brand-700 underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
