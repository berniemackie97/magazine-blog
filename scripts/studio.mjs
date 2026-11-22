import { spawn } from "node:child_process";
const child = spawn(
  process.execPath,
  [
    "node_modules/astro/astro.js",
    "dev",
    "--host",
    "127.0.0.1",
    ...process.argv.slice(2),
  ],
  {
    stdio: "inherit",
    env: { ...process.env, RACK_STUDIO_LOCAL: "1" },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
