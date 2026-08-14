import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "public");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const source of ["index.html", "assets", "css", "js"]) {
  await cp(path.join(root, source), path.join(output, source), { recursive: true });
}

console.log("Prepared static GREENers Carbon assets in public/.");
