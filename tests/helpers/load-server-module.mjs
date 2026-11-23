import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../../package.json", import.meta.url));
export const nextServer = { NextResponse: { json: (body, init) => Response.json(body, init) } };

/** Execute actual TS server modules, replacing only explicit service boundaries. */
export function loadServerModule(relativePath, mocks = {}, cache = new Map()) {
  if (cache.has(relativePath)) return cache.get(relativePath);
  const source = readFileSync(root + relativePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    },
  }).outputText;
  const loaded = { exports: {} };
  const imports = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "server-only") return {};
    if (name === "next/server") return nextServer;
    if (name.startsWith("@/lib/")) return loadServerModule(name.slice(2) + ".ts", mocks, cache);
    if (name.startsWith("node:") || name === "sharp") return require(name);
    throw new Error("Unmocked module: " + name);
  };
  new Function("require", "module", "exports", compiled)(imports, loaded, loaded.exports);
  cache.set(relativePath, loaded.exports);
  return loaded.exports;
}
