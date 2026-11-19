export const HANDOVER_RETURN_GRACE_MINUTES = 30;

export type TransitionTimingEvaluation =
  | { outsideWindow: false }
  | {
      outsideWindow: true;
      direction: "early" | "late";
      deltaMinutes: number;
      formattedDelta: string;
      summary: string;
    };

export function formatTimingDelta(totalMinutes: number): string {
  const mins = Math.max(1, Math.round(totalMinutes));
  if (mins < 60) return `${mins}m`;
  const days = Math.floor(mins / (60 * 24));
  const remAfterDays = mins % (60 * 24);
  const hours = Math.floor(remAfterDays / 60);
  const remMins = remAfterDays % 60;
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

/**
 * Checks whether a handover (compared to `starts_at`) or return (compared to `ends_at`)
 * is happening outside the ±30 minute scheduled window.
 */
export function evaluateTransitionTiming(
  mode: "handover" | "return",
  scheduledIso: string | null | undefined,
  nowMs: number = Date.now(),
): TransitionTimingEvaluation {
  if (!scheduledIso) return { outsideWindow: false };
  const scheduledMs = Date.parse(scheduledIso);
  if (Number.isNaN(scheduledMs)) return { outsideWindow: false };

  const diffMs = nowMs - scheduledMs;
  const graceMs = HANDOVER_RETURN_GRACE_MINUTES * 60 * 1000;
  if (Math.abs(diffMs) <= graceMs) {
    return { outsideWindow: false };
  }

  const direction: "early" | "late" = diffMs < 0 ? "early" : "late";
  const deltaMinutes = Math.max(
    HANDOVER_RETURN_GRACE_MINUTES + 1,
    Math.round(Math.abs(diffMs) / 60000),
  );
  const formattedDelta = formatTimingDelta(deltaMinutes);
  const label = mode === "handover" ? "Scheduled departure" : "Scheduled return";
  const summary =
    direction === "early"
      ? `${label} is in ${formattedDelta} (more than ${HANDOVER_RETURN_GRACE_MINUTES} minutes early).`
      : `${label} was ${formattedDelta} ago (more than ${HANDOVER_RETURN_GRACE_MINUTES} minutes late).`;

  return {
    outsideWindow: true,
    direction,
    deltaMinutes,
    formattedDelta,
    summary,
  };
}

const LETTERS_LOWER = "abcdefghjkmnpqrstuvwxyz";
const LETTERS_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const ALL_CHARS = LETTERS_LOWER + LETTERS_UPPER + DIGITS;

/**
 * Generates a cryptographically random 14-character temporary password
 * guaranteed to contain uppercase, lowercase, and digits (passes >= 12 char rule).
 */
export function generateDriverPassword(length = 14): string {
  const safeLength = Math.max(12, length);
  const bytes = new Uint32Array(safeLength + 8);
  crypto.getRandomValues(bytes);

  const chars: string[] = [
    LETTERS_UPPER[bytes[0] % LETTERS_UPPER.length],
    LETTERS_LOWER[bytes[1] % LETTERS_LOWER.length],
    DIGITS[bytes[2] % DIGITS.length],
  ];
  for (let i = 3; i < safeLength; i++) {
    chars.push(ALL_CHARS[bytes[i] % ALL_CHARS.length]);
  }
  // Fisher-Yates shuffle using remaining CSPRNG values
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[safeLength + (i % 8)] % (i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join("");
}
