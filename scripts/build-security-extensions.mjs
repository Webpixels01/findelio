import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
for (const name of ["review-notification", "request-security"]) {
  const base = new URL(`../infra/directus/extensions/directus-extension-findelio-${name}/`, import.meta.url);
  await mkdir(new URL("dist/", base), { recursive: true });
  for (const file of await readdir(new URL("src/", base))) {
    if (file.endsWith(".js")) {
      await writeFile(new URL(`dist/${file}`, base), await readFile(new URL(`src/${file}`, base)));
    }
  }
}
