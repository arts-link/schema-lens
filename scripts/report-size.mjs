import { gzipSync } from "node:zlib";
import console from "node:console";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";

const bundles = [
  ["@schema-lens/core", new URL("../packages/core/dist/index.js", import.meta.url)],
  ["@schema-lens/overlay", new URL("../packages/overlay/dist/index.js", import.meta.url)],
];

for (const [name, url] of bundles) {
  let content;
  try {
    content = await readFile(url);
  } catch {
    throw new Error(`Missing ${name} build output. Run pnpm build before pnpm size.`);
  }
  const raw = formatBytes(content.byteLength);
  const gzip = formatBytes(gzipSync(content).byteLength);
  console.log(`${name}: ${raw} raw, ${gzip} gzip`);
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} kB`;
}
