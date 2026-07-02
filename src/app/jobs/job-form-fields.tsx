import { FieldRow } from "@/components/field-row";
import { Input } from "@/components/inputs";
import type { JobRow } from "./job-card";

/**
 * The posting form fields, shared by the member submit form (/jobs) and the
 * admin edit form (/jobs/[id]/edit). Pass `defaults` to pre-fill for editing;
 * omit it for a blank new-posting form. The enclosing <form> owns the action
 * and submit button.
 */
export function JobFields({
  defaults,
}: {
  defaults?: Pick<
    JobRow,
    "title" | "company" | "location" | "apply_url" | "contact" | "description"
  >;
}) {
  return (
    <>
      <FieldRow
        label="Title"
        help="Full-time, internship, contract, gig — anything. e.g. Senior PM."
      >
        <Input
          name="title"
          required
          maxLength={120}
          defaultValue={defaults?.title ?? ""}
          placeholder="Role or opportunity title"
        />
      </FieldRow>
      <FieldRow label="Company">
        <Input
          name="company"
          required
          maxLength={120}
          defaultValue={defaults?.company ?? ""}
          placeholder="Company"
        />
      </FieldRow>
      <FieldRow label="Location" help="Optional. City / remote / hybrid.">
        <Input
          name="location"
          maxLength={120}
          defaultValue={defaults?.location ?? ""}
          placeholder="e.g. NYC or Remote"
        />
      </FieldRow>
      <FieldRow
        label="Apply link"
        help="Optional. Must be an http(s) URL — anything else is dropped."
      >
        <Input
          name="apply_url"
          type="url"
          defaultValue={defaults?.apply_url ?? ""}
          placeholder="https://…"
        />
      </FieldRow>
      <FieldRow
        label="Contact"
        help="Optional. How interested classmates reach you or the hiring team."
      >
        <Input
          name="contact"
          maxLength={120}
          defaultValue={defaults?.contact ?? ""}
          placeholder="e.g. jane@company.com"
        />
      </FieldRow>
      <FieldRow
        label="Description"
        help="What it is, who it's a fit for, anything a classmate should know."
      >
        <textarea
          name="description"
          required
          maxLength={5000}
          rows={6}
          defaultValue={defaults?.description ?? ""}
          placeholder="Tell the class about the role…"
          className="w-full rounded border border-line bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink-3/70 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
      </FieldRow>
    </>
  );
}
