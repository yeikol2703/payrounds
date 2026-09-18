import type { SplitMode } from "@/lib/types";

/** Equal share for owner + N friends (owner counts as +1). */
export function equalShare(totalCost: number, friendCount: number): number {
  const parts = Math.max(1, friendCount + 1);
  return parseFloat((totalCost / parts).toFixed(2));
}

/** Sum of custom amounts must match total within 1 cent. */
export function customAmountsSumOk(
  amounts: number[],
  totalCost: number,
): boolean {
  if (amounts.length === 0) {
    return false;
  }
  const sum = amounts.reduce((a, b) => a + b, 0);
  return Math.abs(sum - totalCost) < 0.015;
}

export function resolveSplitMode(
  mode: SplitMode | undefined | null,
): SplitMode {
  return mode === "custom" ? "custom" : "equal";
}
