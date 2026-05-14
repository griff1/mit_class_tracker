import Link from "next/link";
import { signIn } from "@/app/auth/actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-700">
          MIT Sloan Class of 2026
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          Sign in
        </h1>
      </header>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <form action={signIn} className="flex flex-col gap-4">
        <Field label="MIT email" name="email" type="email" placeholder="you@mit.edu" required />
        <Field label="Password" name="password" type="password" required />
        <button
          type="submit"
          className="rounded-md bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600"
        >
          Sign in
        </button>
      </form>
      <p className="text-sm text-stone-600">
        No account yet?{" "}
        <Link href="/sign-up" className="font-medium text-brand-700 underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-stone-800">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
    </label>
  );
}
