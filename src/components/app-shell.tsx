import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "@/components/avatar";
import type { Viewer } from "@/lib/viewer";

type SectionKey =
  | "home"
  | "directory"
  | "jobs"
  | "stats"
  | "referrals"
  | "profile";

const SECTIONS: { key: SectionKey; href: string; label: string; available: boolean }[] = [
  { key: "home", href: "/", label: "Home", available: true },
  { key: "directory", href: "/directory", label: "Directory", available: true },
  { key: "jobs", href: "/jobs", label: "Opportunities", available: true },
  { key: "stats", href: "/stats", label: "Stats", available: true },
  { key: "referrals", href: "/referrals", label: "Referrals", available: true },
  { key: "profile", href: "/profile", label: "Profile", available: true },
];

export function AppShell({
  active,
  user,
  children,
}: {
  active: SectionKey;
  user: Viewer;
  children: React.ReactNode;
}) {
  const displayName = user.name?.trim() || user.email;
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <nav className="grid grid-cols-2 items-center gap-y-2 rounded-md border border-line bg-paper px-4 py-2.5 sm:flex sm:justify-between sm:gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 sm:order-1 sm:gap-3"
        >
          <Image
            src="/mit-sloan-logo.png"
            alt="MIT Sloan"
            width={3300}
            height={2550}
            className="h-10 w-auto sm:h-14"
            priority
          />
          <span className="hidden font-mono text-[0.65rem] font-medium uppercase tracking-[0.18em] text-brand-700 sm:inline">
            Class of &apos;26
          </span>
        </Link>
        <form
          action={signOut}
          className="flex items-center justify-end gap-2 sm:order-3 sm:gap-3"
        >
          <Avatar
            name={displayName}
            size="sm"
            photoUrl={user.photoUrl}
            ocean={user.ocean}
          />
          <button
            type="submit"
            className="text-xs text-ink-2 underline-offset-4 hover:text-brand-700 hover:underline"
          >
            Sign out
          </button>
        </form>
        <ul className="col-span-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-sm sm:order-2 sm:flex-nowrap sm:gap-5">
          {SECTIONS.map((s) => {
            const isActive = s.key === active;
            const baseClass = isActive
              ? "relative font-medium text-ink after:absolute after:-bottom-3 after:left-0 after:right-0 after:h-0.5 after:bg-brand-500"
              : "text-ink-2 hover:text-ink";
            return (
              <li key={s.key}>
                {s.available ? (
                  <Link href={s.href} className={baseClass}>
                    {s.label}
                  </Link>
                ) : (
                  <span className="text-ink-3" title="Coming soon">
                    {s.label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      {!user.personalEmail && (
        <Link
          href="/profile"
          className="block rounded-md border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-sm text-amber-800 transition hover:bg-amber-50"
        >
          <span className="font-medium">Add a personal email</span> on your
          profile — your sign-in moves to it automatically so you don&apos;t
          lose access when your MIT email expires. →
        </Link>
      )}
      {children}
    </div>
  );
}
