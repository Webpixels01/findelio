/**
 * Calendar-month premium trial end dates in Europe/Zurich.
 *
 * Adds three calendar months to an instant, preserving the Zurich local
 * wall-clock time. Missing calendar days clamp to the last day of the
 * target month (e.g. 31 Jan → 30 Apr).
 *
 * DST disambiguation (Temporal "compatible"):
 * - Gap (spring forward, local time does not exist): use the UTC instant from
 *   the earlier (pre-transition) offset so the Zurich wall time after the gap
 *   is preserved in clock minutes (e.g. 02:30 → 03:30).
 * - Overlap (fall back, local time occurs twice): use the earlier occurrence.
 */

export const REFERRAL_TRIAL_TIME_ZONE = "Europe/Zurich";
export const REFERRAL_TRIAL_MONTHS = 3;

type ZurichParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

function assertValidDate(value: Date, label: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new RangeError(`${label} must be a valid Date`);
  }
}

function getZurichParts(instant: Date): ZurichParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: REFERRAL_TRIAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    fractionalSecondDigits: 3,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    millisecond: Number(parts.fractionalSecond ?? "0"),
  };
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addCalendarMonths(parts: ZurichParts, months: number): ZurichParts {
  const monthIndexZero = parts.month - 1 + months;
  const year = parts.year + Math.floor(monthIndexZero / 12);
  const month = ((monthIndexZero % 12) + 12) % 12 + 1;
  const day = Math.min(parts.day, lastDayOfMonth(year, month));

  return {
    ...parts,
    year,
    month,
    day,
  };
}

/**
 * Returns the Zurich offset (ms east of UTC) that applies at a UTC instant.
 */
function zurichOffsetMsAt(instantMs: number): number {
  const instant = new Date(instantMs);
  const parts = getZurichParts(instant);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
  return asUtc - instantMs;
}

/**
 * Converts a Zurich local wall time to a UTC Date.
 * Uses Temporal-compatible disambiguation for DST gaps and overlaps.
 */
export function zonedZurichTimeToUtc(parts: ZurichParts): Date {
  const localAsUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );

  const estimateOffset = zurichOffsetMsAt(localAsUtcMs);
  let utcMs = localAsUtcMs - estimateOffset;
  const confirmedOffset = zurichOffsetMsAt(utcMs);
  utcMs = localAsUtcMs - confirmedOffset;

  const beforeMs = utcMs - 60 * 60 * 1000;
  const afterMs = utcMs + 60 * 60 * 1000;
  const candidates = [beforeMs, utcMs, afterMs].filter((candidate) => {
    const roundTrip = getZurichParts(new Date(candidate));
    return (
      roundTrip.year === parts.year &&
      roundTrip.month === parts.month &&
      roundTrip.day === parts.day &&
      roundTrip.hour === parts.hour &&
      roundTrip.minute === parts.minute &&
      roundTrip.second === parts.second &&
      roundTrip.millisecond === parts.millisecond
    );
  });

  const unique = [...new Set(candidates)].sort((left, right) => left - right);

  if (unique.length >= 1) {
    // Overlap: earlier occurrence. Exact match: that instant.
    return new Date(unique[0]!);
  }

  // Gap (spring forward): local wall time does not exist.
  // Compatible/later: interpret with the pre-transition offset so the UTC
  // instant round-trips to the post-gap wall time (e.g. 02:30 → 03:30).
  const surroundingOffsets = [
    zurichOffsetMsAt(localAsUtcMs - 3 * 60 * 60 * 1000),
    zurichOffsetMsAt(localAsUtcMs + 3 * 60 * 60 * 1000),
  ];
  const earlierOffset = Math.min(...surroundingOffsets);
  return new Date(localAsUtcMs - earlierOffset);
}

/**
 * Returns the UTC instant when a referral premium trial ends:
 * start + 3 calendar months in Europe/Zurich.
 */
export function getReferralTrialEndsAt(startsAt: Date): Date {
  assertValidDate(startsAt, "startsAt");
  const startParts = getZurichParts(startsAt);
  const endParts = addCalendarMonths(startParts, REFERRAL_TRIAL_MONTHS);
  return zonedZurichTimeToUtc(endParts);
}

/** @internal exported for tests */
export function getZurichPartsForTests(instant: Date): ZurichParts {
  assertValidDate(instant, "instant");
  return getZurichParts(instant);
}
