import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INDUSTRIES, OCEANS, type Profile } from "@/lib/types";
import { updateProfile } from "./actions";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (fetchError) {
    return (
      <ErrorShell
        title="Couldn't load your profile"
        message={fetchError.message}
      />
    );
  }
  if (!profile) {
    return (
      <ErrorShell
        title="Profile not found"
        message="Your auth account exists but no profile row was created. Check that the schema migration ran."
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-8">
      <nav className="text-sm">
        <Link
          href="/"
          className="text-stone-600 underline-offset-4 hover:text-brand-700 hover:underline"
        >
          ← Home
        </Link>
      </nav>

      <header className="flex flex-col gap-2 border-b border-stone-200 pb-5">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-700">
          Your profile
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          {profile.name ?? "Tell your class about yourself"}
        </h1>
        <p className="text-sm text-stone-600">
          Visible to other signed-in <code className="font-mono">@mit.edu</code> classmates.
        </p>
      </header>

      {saved && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Profile saved.
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <form action={updateProfile} className="flex flex-col gap-5">
        <Section title="Identity">
          <ReadOnlyField label="MIT email" value={profile.mit_email} />
          <Field
            label="Display name"
            name="name"
            defaultValue={profile.name ?? ""}
            placeholder="Jane Doe"
          />
          <Field
            label="Personal email (optional)"
            name="personal_email"
            type="email"
            defaultValue={profile.personal_email ?? ""}
            placeholder="jane@gmail.com"
            help="Where to reach you after your MIT email expires."
          />
        </Section>

        <Section title="Work">
          <Field
            label="Company"
            name="company"
            defaultValue={profile.company ?? ""}
            placeholder="Acme Corp"
          />
          <Field
            label="Title"
            name="title"
            defaultValue={profile.title ?? ""}
            placeholder="Product Manager"
          />
          <CheckboxGroup
            label="Industries"
            name="industries"
            defaultValue={profile.industries}
            options={INDUSTRIES}
            help="Pick all that apply."
          />
        </Section>

        <Section title="Location & links">
          <Field
            label="City"
            name="city"
            defaultValue={profile.city ?? ""}
            placeholder="New York, NY"
            help="City only — we don't collect addresses."
          />
          <Field
            label="LinkedIn URL"
            name="linkedin_url"
            type="url"
            defaultValue={profile.linkedin_url ?? ""}
            placeholder="https://www.linkedin.com/in/..."
          />
          <SelectField
            label="Ocean (Sloan cohort)"
            name="ocean"
            defaultValue={profile.ocean ?? ""}
            options={OCEANS}
          />
        </Section>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="rounded-md bg-brand-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600"
          >
            Save profile
          </button>
        </div>
      </form>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-5">
      <legend className="px-1 text-xs font-medium uppercase tracking-wider text-stone-500">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  help,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  help?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-stone-800">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
      {help && <span className="text-xs text-stone-500">{help}</span>}
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: readonly string[];
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-stone-800">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
      >
        <option value="">— Select —</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxGroup({
  label,
  name,
  options,
  defaultValue,
  help,
}: {
  label: string;
  name: string;
  options: readonly string[];
  defaultValue: readonly string[];
  help?: string;
}) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-stone-800">{label}</span>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {options.map((opt) => (
          <label
            key={opt}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-stone-700 hover:bg-stone-100"
          >
            <input
              type="checkbox"
              name={name}
              value={opt}
              defaultChecked={defaultValue.includes(opt)}
              className="h-4 w-4 rounded border-stone-300 accent-brand-500"
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>
      {help && <span className="text-xs text-stone-500">{help}</span>}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-stone-800">{label}</span>
      <div className="rounded-md border border-stone-200 bg-stone-100 px-3 py-2 font-mono text-stone-700">
        {value}
      </div>
    </div>
  );
}

function ErrorShell({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-3 p-8">
      <Link
        href="/"
        className="text-sm text-stone-600 underline-offset-4 hover:text-brand-700 hover:underline"
      >
        ← Home
      </Link>
      <h1 className="text-2xl font-semibold text-stone-900">{title}</h1>
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {message}
      </p>
    </main>
  );
}
