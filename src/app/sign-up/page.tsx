import Link from "next/link";
import { signUp } from "@/app/auth/actions";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; check?: string }>;
}) {
  const { error, check } = await searchParams;

  if (check === "email") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-8">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-700">
          MIT Sloan Class of 2026
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          Check your email
        </h1>
        <p className="text-stone-700">
          We just sent a confirmation link to your MIT email. Open it to finish signing up.
        </p>
        <p className="text-sm text-stone-500">
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
        <p className="text-xs font-medium uppercase tracking-wider text-brand-700">
          MIT Sloan Class of 2026
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          Sign up
        </h1>
        <p className="text-sm text-stone-600">
          Restricted to <code className="font-mono">@mit.edu</code> email addresses.
          You&apos;ll confirm your email before signing in.
        </p>
      </header>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <form action={signUp} className="flex flex-col gap-4">
        <Field
          label="MIT email"
          name="email"
          type="email"
          placeholder="you@mit.edu"
          pattern="^[^@\s]+@mit\.edu$"
          title="Must be an @mit.edu address"
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          minLength={8}
          required
        />
        <button
          type="submit"
          className="rounded-md bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600"
        >
          Sign up
        </button>
      </form>
      <p className="text-sm text-stone-600">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-brand-700 underline-offset-4 hover:underline">
          Sign in
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
  pattern,
  title,
  minLength,
  required,
}: {
  label: string;
  name: string;
  type: string;
  placeholder?: string;
  pattern?: string;
  title?: string;
  minLength?: number;
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
        pattern={pattern}
        title={title}
        minLength={minLength}
        className="rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
    </label>
  );
}
