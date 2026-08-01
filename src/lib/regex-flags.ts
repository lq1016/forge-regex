export const FLAG_CHIPS = ["g", "i", "m", "s", "u"] as const;
export type FlagChip = (typeof FLAG_CHIPS)[number];

/** Keep only known chips, stable order g-i-m-s-u, drop unknowns. */
export function normalizeFlags(flags: string): string {
  const set = new Set(flags.split(""));
  return FLAG_CHIPS.filter((f) => set.has(f)).join("");
}

export function toggleFlag(flags: string, flag: FlagChip): string {
  const set = new Set(normalizeFlags(flags).split(""));
  if (set.has(flag)) set.delete(flag);
  else set.add(flag);
  return FLAG_CHIPS.filter((f) => set.has(f)).join("");
}

export function hasFlag(flags: string, flag: FlagChip): boolean {
  return normalizeFlags(flags).includes(flag);
}
