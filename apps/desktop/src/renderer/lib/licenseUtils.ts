/**
 * License utility helpers — shared between Dashboard and MainLayout
 * to avoid duplicating statusColor / differenceInDays logic.
 */

/**
 * Returns Tailwind border/bg/text classes for a license badge.
 * Color rules:
 *   ACTIVE        → emerald (green)
 *   TRIAL > 7d    → sky (blue)
 *   TRIAL ≤ 7d    → amber (orange warning)
 *   anything else → rose (red)
 */
export function getLicenseBadgeClass(state: string, daysRemaining: number): string {
  if (state === "ACTIVE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  if (state === "TRIAL" && daysRemaining > 7) {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200";
  }

  if (state === "TRIAL" && daysRemaining <= 7) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
  }

  return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
}

/**
 * Calculates days remaining until `expiresAt` (epoch ms).
 * Returns 0 when already expired or when expiresAt is null.
 */
export function calcDaysRemaining(expiresAt: number | null): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}
