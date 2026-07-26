import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Transports `git` can fetch from without handing it an executable.
 *
 * Notably absent is `ext:`, which makes a repository location run a command of
 * its own choosing. `file:` is kept so a local clone can be analyzed directly.
 */
const FETCHABLE_TRANSPORTS = new Set(["https:", "git:", "ssh:", "file:"]);

/**
 * Decide whether a repository location is safe to hand to `git` as a location.
 *
 * `git` reads a leading `-` as an option, so a location like
 * `--upload-pack=<command>` becomes arbitrary command execution. Callers pass
 * this before spawning git, and pass the location after a `--` separator.
 */
export function isFetchableRepositoryLocation(location: string): boolean {
  if (!location || location.startsWith("-")) return false;
  try {
    return FETCHABLE_TRANSPORTS.has(new URL(location).protocol);
  } catch {
    return false;
  }
}

/**
 * Read the commit a repository's default branch currently points at.
 *
 * This is a metadata-only request, so an already analyzed commit can be served
 * from the store without paying for a clone. An unreachable, private, removed,
 * or unsafe repository location resolves to `undefined` rather than failing:
 * the caller falls back to a full analysis, which reports the real error.
 */
export async function resolveHeadCommit(repositoryUrl: string): Promise<string | undefined> {
  if (!isFetchableRepositoryLocation(repositoryUrl)) return undefined;
  try {
    const { stdout } = await execFileAsync("git", ["ls-remote", "--quiet", "--", repositoryUrl, "HEAD"], {
      timeout: 15_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "", GCM_INTERACTIVE: "never" }
    });
    const sha = stdout.split(/\s+/, 1)[0]?.trim();
    return /^[0-9a-f]{7,64}$/i.test(sha ?? "") ? sha : undefined;
  } catch {
    return undefined;
  }
}
