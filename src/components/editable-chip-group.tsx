import { Chip } from "@/components/chip";
import { Input } from "@/components/inputs";

/**
 * A multi-select chip group where the user can also type in a new value not
 * yet in the list. The hidden text input ships as a separate form field
 * (`newName`); the server action merges it with the chip values and resolves
 * canonical casing against the cohort.
 *
 * `options` should be the union of the seed list and all currently-known
 * cohort values — render-time canonical dedup happens inside.
 */
export function EditableChipGroup({
  name,
  newName,
  options,
  selected,
  newPlaceholder,
}: {
  name: string;
  newName: string;
  options: readonly string[];
  selected: readonly string[];
  newPlaceholder?: string;
}) {
  // Union of options + selected, case-insensitive, first-seen casing wins.
  // Selected values not in `options` (e.g. user's previous custom adds) still
  // render as chips so they can be unchecked.
  const seen = new Map<string, string>();
  for (const v of options) {
    const k = v.toLowerCase();
    if (!seen.has(k)) seen.set(k, v);
  }
  for (const v of selected) {
    const k = v.toLowerCase();
    if (!seen.has(k)) seen.set(k, v);
  }
  const canonical = Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  const selectedLower = new Set(selected.map((s) => s.toLowerCase()));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {canonical.map((opt) => (
          <Chip
            key={opt}
            name={name}
            value={opt}
            defaultChecked={selectedLower.has(opt.toLowerCase())}
          />
        ))}
      </div>
      <Input
        name={newName}
        type="text"
        placeholder={newPlaceholder ?? "Or add a new one"}
      />
    </div>
  );
}
