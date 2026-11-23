import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const packageUrl = new URL(import.meta.resolve("astro/package.json"));
const { bin } = JSON.parse(await readFile(packageUrl, "utf8"));
const cli = fileURLToPath(new URL(bin.astro, packageUrl));
const args = process.argv.slice(2);
if (args.some((arg) => arg === "--host" || arg.startsWith("--host=")))
  throw new Error(
    "Studio must stay bound to 127.0.0.1. Use hosted authentication for remote editing.",
  );
const portIndex = args.indexOf("--port");
const port =
  args.find((arg) => arg.startsWith("--port="))?.slice(7) ??
  (portIndex >= 0 ? args[portIndex + 1] : "4321");
console.log(`\nEditorial Studio: http://127.0.0.1:${port}/studio\n`);
const child = spawn(
  process.execPath,
  [cli, "dev", "--host", "127.0.0.1", ...args],
  {
    stdio: "inherit",
    env: { ...process.env, RACK_STUDIO_LOCAL: "1" },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
