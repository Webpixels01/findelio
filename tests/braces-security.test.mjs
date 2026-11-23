import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const braces = require("braces");

test("installed braces retains ordinary brace and range expansion", () => {
  const micromatchRequire = createRequire(require.resolve("micromatch"));
  assert.equal(micromatchRequire.resolve("braces"), require.resolve("braces"), "Transitive consumers use the patched copy");
  assert.deepEqual(braces.expand("src/{app,lib}/*.{ts,tsx}"), [
    "src/app/*.ts", "src/app/*.tsx", "src/lib/*.ts", "src/lib/*.tsx",
  ]);
  assert.deepEqual(braces.expand("{1..3}"), ["1", "2", "3"]);
  assert.equal(braces.compile("a/{b,c}"), "a/(b|c)");
});

test("deep brace and parenthesis patterns fail before recursive walkers", () => {
  for (const [open, close] of [["{", "}"], ["(", ")"]]) {
    const pattern = open.repeat(4_000) + "a,b" + close.repeat(4_000);
    for (const method of ["parse", "compile", "expand", "stringify"]) {
      assert.throws(() => braces[method](pattern), /security limit/);
    }
  }
});

test("hand-built deep and cyclic ASTs cannot bypass the parser guard", () => {
  const cyclic = { type: "root", nodes: [] };
  cyclic.nodes.push(cyclic);
  let deep = { type: "text", value: "x" };
  for (let i = 0; i < 5000; i++) deep = { type: "root", nodes: [deep] };
  for (const method of ["compile", "expand", "stringify"]) {
    assert.throws(() => braces[method](deep), /security limit/);
    assert.throws(() => braces[method](cyclic), /security limit/);
  }
});
