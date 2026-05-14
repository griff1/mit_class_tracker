import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-8 p-8">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-medium uppercase tracking-wider text-brand-700">
            MIT Sloan Class of 2026
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
            Stay in touch with your class.
          </h1>
          <p className="text-stone-600">
            A private directory for finding classmates, sharing where you landed,
            and keeping the cohort connected after graduation.
          </p>
        </header>
        <div className="flex gap-3">
          <Link
            href="/sign-in"
            className="rounded-md bg-brand-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-800 transition hover:border-stone-400 hover:bg-stone-50"
          >
            Sign up
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-8">
      <header className="flex items-baseline justify-between gap-4 border-b border-stone-200 pb-5">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-700">
            Class of 2026
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            MIT Sloan Directory
          </h1>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-stone-600 underline-offset-4 hover:text-brand-700 hover:underline"
          >
            Sign out
          </button>
        </form>
      </header>

      <p className="text-sm text-stone-600">
        Signed in as <code className="font-mono text-stone-800">{user.email}</code>.
      </p>

      <nav className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NavCard
          href="/profile"
          title="Your profile"
          description="Update your info — company, title, city, LinkedIn."
          available
        />
        <NavCard
          href="/directory"
          title="Directory"
          description="Search classmates by industry, role, or city."
          available
        />
        <NavCard
          href="#"
          title="Map"
          description="See where everyone landed, aggregated by city."
        />
        <NavCard
          href="#"
          title="Stats"
          description="Top cities and industries across the cohort."
        />
      </nav>
    </main>
  );
}

function NavCard({
  href,
  title,
  description,
  available = false,
}: {
  href: string;
  title: string;
  description: string;
  available?: boolean;
}) {
  const classes =
    "flex flex-col gap-1 rounded-lg border bg-white p-4 transition";
  if (!available) {
    return (
      <div
        className={`${classes} cursor-not-allowed border-stone-200 opacity-60`}
        aria-disabled="true"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-medium text-stone-700">{title}</h2>
          <span className="text-xs font-medium uppercase tracking-wider text-stone-400">
            Soon
          </span>
        </div>
        <p className="text-sm text-stone-500">{description}</p>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className={`${classes} border-stone-200 hover:border-brand-400 hover:bg-brand-50`}
    >
      <h2 className="text-base font-medium text-stone-900">{title}</h2>
      <p className="text-sm text-stone-600">{description}</p>
    </Link>
  );
}
