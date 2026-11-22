import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { StudioError } from "./content";
export async function acquireWriteLock(
  root: string,
): Promise<() => Promise<void>> {
  const directory = resolve(root, ".studio");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = resolve(directory, "write.lock");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await writeFile(path, String(process.pid), { flag: "wx", mode: 0o600 });
      return () => unlink(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const owner = Number(await readFile(path, "utf8"));
      if (Number.isSafeInteger(owner) && owner > 0) {
        try {
          process.kill(owner, 0);
        } catch (cause) {
          if ((cause as NodeJS.ErrnoException).code === "ESRCH") {
            await unlink(path);
            continue;
          }
        }
      }
      throw new StudioError(
        409,
        "Another save or release is running. Try again when it finishes.",
      );
    }
  }
  throw new StudioError(409, "The workspace is busy. Try again.");
}
