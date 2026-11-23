import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const packageUrl = new URL(import.meta.resolve("astro/package.json"));
const { bin } = JSON.parse(await readFile(packageUrl, "utf8"));
const cli = fileURLToPath(new URL(bin.astro, packageUrl));
const child = spawn(
  process.execPath,
  [cli, "dev", "--host", "127.0.0.1", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, RACK_STUDIO_LOCAL: "1" },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
