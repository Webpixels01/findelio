import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getReferralTrialEndsAt,
  getZurichPartsForTests,
  zonedZurichTimeToUtc,
} from "./referral-dates.ts";

function zurichInstant(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
  millisecond?: number;
}): Date {
  return zonedZurichTimeToUtc({
    second: 0,
    millisecond: 0,
    ...parts,
  });
}

test("normal date keeps Zurich wall time after three months", () => {
  const start = zurichInstant({
    year: 2026,
    month: 1,
    day: 15,
    hour: 14,
    minute: 30,
    second: 45,
    millisecond: 123,
  });
  const end = getReferralTrialEndsAt(start);
  assert.deepEqual(getZurichPartsForTests(end), {
    year: 2026,
    month: 4,
    day: 15,
    hour: 14,
    minute: 30,
    second: 45,
    millisecond: 123,
  });
});

test("month-end clamps to last day of target month", () => {
  const start = zurichInstant({
    year: 2026,
    month: 1,
    day: 31,
    hour: 10,
    minute: 0,
  });
  const end = getReferralTrialEndsAt(start);
  assert.deepEqual(getZurichPartsForTests(end), {
    year: 2026,
    month: 4,
    day: 30,
    hour: 10,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
});

test("leap day clamps in non-leap target month path via Jan 31 → Apr 30", () => {
  const start = zurichInstant({
    year: 2024,
    month: 11,
    day: 29,
    hour: 9,
    minute: 15,
  });
  const end = getReferralTrialEndsAt(start);
  assert.deepEqual(getZurichPartsForTests(end), {
    year: 2025,
    month: 2,
    day: 28,
    hour: 9,
    minute: 15,
    second: 0,
    millisecond: 0,
  });
});

test("leap day 29 Feb keeps 29 May in leap year cycle", () => {
  const start = zurichInstant({
    year: 2024,
    month: 2,
    day: 29,
    hour: 12,
    minute: 0,
  });
  const end = getReferralTrialEndsAt(start);
  assert.deepEqual(getZurichPartsForTests(end), {
    year: 2024,
    month: 5,
    day: 29,
    hour: 12,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
});

test("spring-forward gap uses later compatible instant", () => {
  // 2026-03-29: clocks jump 02:00 → 03:00 in Europe/Zurich.
  // 29 Dec 2025 02:30 + 3 months ⇒ 29 Mar 2026 02:30 (non-existent).
  const start = zurichInstant({
    year: 2025,
    month: 12,
    day: 29,
    hour: 2,
    minute: 30,
  });
  const end = getReferralTrialEndsAt(start);
  const parts = getZurichPartsForTests(end);
  assert.equal(parts.year, 2026);
  assert.equal(parts.month, 3);
  assert.equal(parts.day, 29);
  assert.equal(parts.hour, 3);
  assert.equal(parts.minute, 30);
});

test("fall-back overlap prefers earlier occurrence", () => {
  // 2026-10-25: clocks repeat 02:00–03:00 in Europe/Zurich.
  // 25 Jul 2026 02:30 + 3 months ⇒ 25 Oct 2026 02:30 (ambiguous).
  const start = zurichInstant({
    year: 2026,
    month: 7,
    day: 25,
    hour: 2,
    minute: 30,
  });
  const end = getReferralTrialEndsAt(start);
  const parts = getZurichPartsForTests(end);
  assert.equal(parts.year, 2026);
  assert.equal(parts.month, 10);
  assert.equal(parts.day, 25);
  assert.equal(parts.hour, 2);
  assert.equal(parts.minute, 30);

  // Earlier occurrence is still on CEST (UTC+2) ⇒ 00:30Z.
  assert.equal(end.toISOString(), "2026-10-25T00:30:00.000Z");
});
