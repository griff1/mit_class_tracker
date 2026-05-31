import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { FieldRow } from "@/components/field-row";
import { Input } from "@/components/inputs";
import { SubmitButton } from "@/components/submit-button";
import { sendReferral } from "./actions";

type OwnReferral = {
  id: string;
  referred_email: string;
  email_sent_at: string;
  completed_at: string | null;
};

type LeaderRow = {
  profile_id: string;
  name: string;
  total_sent: number;
  completed: number;
};

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const viewer = await getViewer(supabase, user);

  // Own referrals (RLS scopes this to referrer_id = auth.uid()). Newest first.
  const { data: own, error: ownError } = await supabase
    .from("referrals")
    .select("id, referred_email, email_sent_at, completed_at")
    .order("email_sent_at", { ascending: false })
    .returns<OwnReferral[]>();

  // Leaderboard. SECURITY DEFINER fn returns top 20 by completed desc.
  const { data: leaderboard, error: leaderboardError } = await supabase.rpc(
    "referral_leaderboard",
    { p_limit: 20 },
  );
  const leaders: LeaderRow[] = (leaderboard as LeaderRow[] | null) ?? [];

  const ownTotal = own?.length ?? 0;
  const ownCompleted = own?.filter((r) => r.completed_at !== null).length ?? 0;

  return (
    <AppShell active="referrals" user={viewer}>
      <PageHeader
        eyebrow="Bring more of the cohort in"
        title="Referrals"
        sub={
          ownTotal === 0
            ? "Invite a classmate who hasn't joined yet. Each MIT-domain address gets one invite per inviter."
            : `${ownCompleted} of ${ownTotal} of your invites have joined.`
        }
      />

      {sent && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800">
          Invite sent to{" "}
          <span className="break-all font-medium">{sent}</span>. It will
          stay pending here until they sign in.
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <form action={sendReferral} className="flex flex-col gap-3">
        <Section label="Send an invite" index={1}>
          <FieldRow
            label="Email"
            help="Must be @mit.edu, @sloan.mit.edu, or @alum.mit.edu. You can only invite a given address once."
          >
            <Input
              name="email"
              type="email"
              required
              placeholder="classmate@mit.edu"
              autoComplete="off"
            />
          </FieldRow>
          <div className="flex justify-end pt-2">
            <SubmitButton pendingLabel="Sending…">Send invite</SubmitButton>
          </div>
        </Section>
      </form>

      <Section label="Your invites" index={2}>
        {ownError && (
          <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
            Couldn&apos;t load your invites: {ownError.message}
          </p>
        )}
        {!ownError && ownTotal === 0 && (
          <p className="text-sm text-ink-3">
            No invites yet. Send your first above.
          </p>
        )}
        {!ownError && ownTotal > 0 && (
          <ul className="flex flex-col">
            {own!.map((r, idx) => (
              <li
                key={r.id}
                className={`flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2 ${
                  idx === 0 ? "" : "border-t border-line"
                }`}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="break-all font-mono text-sm text-ink">
                    {r.referred_email}
                  </span>
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-3">
                    sent {fmtDate(r.email_sent_at)}
                    {r.completed_at &&
                      ` · joined ${fmtDate(r.completed_at)}`}
                  </span>
                </div>
                <div className="flex-none pt-0.5">
                  <StatusPill completed={!!r.completed_at} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section label="Top referrers" index={3}>
        {leaderboardError && (
          <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
            Couldn&apos;t load the leaderboard: {leaderboardError.message}
          </p>
        )}
        {!leaderboardError && leaders.length === 0 && (
          <p className="text-sm text-ink-3">
            Nobody has sent a referral yet. Be the first.
          </p>
        )}
        {!leaderboardError && leaders.length > 0 && (
          <ol className="flex flex-col">
            {leaders.map((row, idx) => (
              <li
                key={row.profile_id}
                className={`flex items-baseline justify-between gap-x-3 py-2 ${
                  idx === 0 ? "" : "border-t border-line"
                } ${
                  row.profile_id === user.id ? "font-medium text-ink" : ""
                }`}
              >
                <span className="flex min-w-0 flex-1 items-baseline gap-2 sm:gap-3">
                  <span className="flex-none font-mono text-[0.7rem] tabular-nums text-ink-3">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 truncate text-sm text-ink">
                    {row.name}
                    {row.profile_id === user.id && (
                      <span className="ml-2 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-brand-700">
                        you
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex-none whitespace-nowrap font-mono text-xs text-ink-2">
                  <span className="text-ink">{row.completed}</span>
                  <span className="text-ink-3"> joined</span>
                  <span className="hidden text-ink-3 sm:inline">
                    {" · "}
                    {row.total_sent} sent
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </AppShell>
  );
}

function StatusPill({ completed }: { completed: boolean }) {
  if (completed) {
    return (
      <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-emerald-800">
        Joined
      </span>
    );
  }
  return (
    <span className="rounded-sm border border-line px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-3">
      Pending
    </span>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
