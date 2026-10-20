import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPreservedLocaleSearch } from "./register-search-params.ts";

test("referral register path keeps ref and email only", () => {
  assert.equal(
    buildPreservedLocaleSearch(
      "/firma-eintragen",
      "?ref=PARTNER&email=a@b.c&token=auth&next=/dashboard",
    ),
    "ref=PARTNER&email=a%40b.c",
  );
});

test("invitation register path keeps invitation and drops referral/auth noise", () => {
  assert.equal(
    buildPreservedLocaleSearch(
      "/firma-eintragen",
      "?invitation=invite-token&ref=PARTNER&email=a@b.c&token=auth",
    ),
    "invitation=invite-token",
  );
});

test("team invitation page keeps token only", () => {
  assert.equal(
    buildPreservedLocaleSearch(
      "/team/einladung",
      "?token=invite-token&ref=PARTNER&next=/x",
    ),
    "token=invite-token",
  );
});

test("unrelated pages preserve no query params", () => {
  assert.equal(
    buildPreservedLocaleSearch(
      "/dashboard",
      "?invitation=x&ref=y&token=z&email=a@b.c",
    ),
    "",
  );
});
