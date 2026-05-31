import { randomBytes } from "node:crypto";

/**
 * Generate a 16-char lowercase-hex referral code. Embedded in the invite
 * link as `?ref=...`. Unique-indexed at the DB level so a collision (very
 * unlikely at 2^64 randomness) would surface as a constraint error and
 * the action retries; no app-side retry yet because the probability is
 * negligible for the cohort size.
 */
export function generateReferralCode(): string {
  return randomBytes(8).toString("hex");
}
