"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/inputs";
import { canonKey } from "@/lib/cities";

/**
 * A multi-select chip group where the user can also type in a value not yet in
 * the list. As they type, existing options that partially match are surfaced as
 * suggestions, so a near-duplicate ("Boston") gets steered onto the canonical
 * entry ("Boston, MA") instead of creating a second tag for the same place.
 *
 * Matching is accent-insensitive (via canonKey), so typing "Sao Paulo" still
 * surfaces "São Paulo, Brazil". The server (resolveCanonical) is the
 * authoritative backstop and additionally folds known aliases.
 *
 * Form contract (unchanged, so the server action is untouched):
 *   - every selected value ships as a `name` field (one per chip)
 *   - any leftover, un-added text in the box ships as the `newName` field
 *
 * `options` should be the union of the seed list and all currently-known cohort
 * values. This is a client component (interactive); it is used only on the
 * profile edit form, not on the JS-less directory filters.
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
  selected: readonly string[] | null | undefined;
  newPlaceholder?: string;
}) {
  // The known universe: normalized key -> canonical display. First-seen casing
  // wins, seed/cohort options before the user's previously-saved values.
  const universe = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of options) {
      const k = canonKey(v);
      if (!seen.has(k)) seen.set(k, v);
    }
    for (const v of selected ?? []) {
      const k = canonKey(v);
      if (!seen.has(k)) seen.set(k, v);
    }
    return seen;
  }, [options, selected]);

  // Selected values are controlled state, initialized from the saved row.
  const [chosen, setChosen] = useState<string[]>(() => {
    const seen = new Map<string, string>();
    for (const v of selected ?? []) {
      const k = canonKey(v);
      if (!seen.has(k)) seen.set(k, v);
    }
    return Array.from(seen.values());
  });
  const [query, setQuery] = useState("");

  const chosenKeys = useMemo(
    () => new Set(chosen.map((s) => canonKey(s))),
    [chosen],
  );

  // The chip palette: every known option plus any freshly-added value, sorted,
  // so the full set stays browsable and newly-created tags render immediately.
  const palette = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of universe.values()) {
      const k = canonKey(v);
      if (!seen.has(k)) seen.set(k, v);
    }
    for (const v of chosen) {
      const k = canonKey(v);
      if (!seen.has(k)) seen.set(k, v);
    }
    return Array.from(seen.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [universe, chosen]);

  const q = query.trim();
  const ql = canonKey(q);
  const exactExists = ql ? universe.has(ql) || chosenKeys.has(ql) : false;

  // Partial matches: not-yet-chosen options whose normalized label contains the
  // normalized query, prefix matches ranked first. Capped so the list stays
  // scannable.
  const suggestions = useMemo(() => {
    if (!ql) return [];
    const starts: string[] = [];
    const includes: string[] = [];
    for (const v of palette) {
      const lk = canonKey(v);
      if (chosenKeys.has(lk)) continue;
      const idx = lk.indexOf(ql);
      if (idx === 0) starts.push(v);
      else if (idx > 0) includes.push(v);
    }
    return [...starts, ...includes].slice(0, 8);
  }, [palette, chosenKeys, ql]);

  function add(display: string) {
    const k = canonKey(display);
    setChosen((prev) =>
      prev.some((s) => canonKey(s) === k)
        ? prev
        : [...prev, universe.get(k) ?? display],
    );
    setQuery("");
  }

  function toggle(display: string) {
    const k = canonKey(display);
    setChosen((prev) =>
      prev.some((s) => canonKey(s) === k)
        ? prev.filter((s) => canonKey(s) !== k)
        : [...prev, universe.get(k) ?? display],
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    // Never let Enter submit the whole profile form from inside the add box.
    e.preventDefault();
    if (!q) return;
    if (exactExists) {
      add(universe.get(ql) ?? q);
    } else if (suggestions.length === 1) {
      // Exactly one existing match — take it (the "Boston" -> "Boston, MA" case).
      add(suggestions[0]);
    } else if (suggestions.length === 0) {
      // Genuinely new value.
      add(q);
    }
    // If several options match, do nothing: let the user click the one they mean.
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {palette.map((opt) => {
          const checked = chosenKeys.has(canonKey(opt));
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              aria-pressed={checked}
              className={`inline-block select-none rounded-sm border px-2 py-0.5 font-mono text-[0.65rem] lowercase uppercase tracking-[0.1em] transition ${
                checked
                  ? "border-brand-100 bg-brand-50 text-brand-700"
                  : "border-line text-ink-2 hover:border-brand-300"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {/* Hidden fields carry the actual form payload. Selected -> `name`,
          leftover typed text -> `newName` (server resolves canonical casing). */}
      {chosen.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}

      <div className="flex flex-col gap-1">
        <Input
          name={newName}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={newPlaceholder ?? "Search or add a new one"}
          autoComplete="off"
        />
        {q && (suggestions.length > 0 || !exactExists) && (
          <div className="overflow-hidden rounded border border-line bg-paper">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="block w-full px-2.5 py-1.5 text-left text-sm text-ink transition hover:bg-cream"
              >
                {s}
              </button>
            ))}
            {!exactExists && (
              <button
                type="button"
                onClick={() => add(q)}
                className={`block w-full px-2.5 py-1.5 text-left text-sm text-brand-700 transition hover:bg-cream ${
                  suggestions.length > 0 ? "border-t border-line" : ""
                }`}
              >
                + Add “{q}” as new
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
