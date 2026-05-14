import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "@/components/avatar";
import type { Viewer } from "@/lib/viewer";

type SectionKey = "home" | "directory" | "map" | "stats" | "profile";

const SECTIONS: { key: SectionKey; href: string; label: string; available: boolean }[] = [
  { key: "home", href: "/", label: "Home", available: true },
  { key: "directory", href: "/directory", label: "Directory", available: true },
  { key: "map", href: "/map", label: "Map", available: true },
  { key: "stats", href: "/stats", label: "Stats", available: true },
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
      <nav className="flex items-center justify-between rounded-md border border-line bg-paper px-4 py-2.5">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/mit-sloan-logo.png"
            alt="MIT Sloan"
            width={3300}
            height={2550}
            className="h-12 w-auto"
            priority
          />
          <span className="hidden font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-3 sm:inline">
            Class of &apos;26
          </span>
        </Link>
        <ul className="flex items-center gap-5 text-sm">
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
        <form action={signOut} className="flex items-center gap-3">
          <Avatar name={displayName} size="sm" photoUrl={user.photoUrl} />
          <button
            type="submit"
            className="text-xs text-ink-2 underline-offset-4 hover:text-brand-700 hover:underline"
          >
            Sign out
          </button>
        </form>
      </nav>
      {children}
    </div>
  );
}
