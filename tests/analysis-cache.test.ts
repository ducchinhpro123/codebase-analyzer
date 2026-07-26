import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import type { AnalysisReport } from "../lib/types";

const execFileAsync = promisify(execFile);

// Keep the suite off the development store: these modules read STORE_FILE when
// they are first loaded, so the override has to happen before the first import.
process.env.STORE_FILE = path.join(os.tmpdir(), `tracepath-cache-test-${process.pid}.json`);
const load = () => Promise.all([
  import("../lib/git-remote"),
  import("../lib/analysis-runner"),
  import("../lib/store"),
  import("../lib/demo")
]);

async function reportFor(repositoryUrl: string, commitSha: string, shareToken: string): Promise<AnalysisReport> {
  const [, , , { demoReport }] = await load();
  return { ...demoReport, id: `report-${shareToken}`, shareToken, repositoryUrl, commitSha };
}

test("the head commit of a repository is read without cloning it", async () => {
  const origin = await fs.mkdtemp(path.join(os.tmpdir(), "tracepath-origin-"));
  try {
    await execFileAsync("git", ["init", "--quiet", "--initial-branch", "main", origin]);
    await fs.writeFile(path.join(origin, "main.ts"), "export const value = 1;\n");
    await execFileAsync("git", ["-C", origin, "add", "."]);
    await execFileAsync("git", ["-C", origin, "-c", "user.email=t@example.com", "-c", "user.name=Test", "commit", "--quiet", "-m", "first"]);
    const { stdout: expected } = await execFileAsync("git", ["-C", origin, "rev-parse", "HEAD"]);

    const [{ resolveHeadCommit }] = await load();
    assert.equal(await resolveHeadCommit(`file://${origin}`), expected.trim());
  } finally {
    await fs.rm(origin, { recursive: true, force: true });
  }
});

test("an unreachable repository resolves to no commit instead of failing", async () => {
  const [{ resolveHeadCommit }] = await load();
  assert.equal(await resolveHeadCommit(`file://${path.join(os.tmpdir(), "tracepath-missing-origin")}`), undefined);
});

test("a repository location that git would read as an option is refused", async () => {
  const [{ resolveHeadCommit }] = await load();
  const marker = path.join(os.tmpdir(), `tracepath-argv-${process.pid}`);

  for (const hostile of [
    `--upload-pack=touch ${marker}`,
    `-u touch ${marker}`,
    `ext::sh -c touch% ${marker}`,
    `--output=${marker}`
  ]) {
    assert.equal(await resolveHeadCommit(hostile), undefined, `${hostile} must not resolve`);
  }

  await assert.rejects(fs.access(marker), "no hostile repository location may run a command");
});

test("only repository transports git can safely fetch are attempted", async () => {
  const [{ resolveHeadCommit }] = await load();

  assert.equal(await resolveHeadCommit("/etc/passwd"), undefined);
  assert.equal(await resolveHeadCommit("ftp://example.com/repo.git"), undefined);
  assert.equal(await resolveHeadCommit(""), undefined);
});

test("a repository already analyzed at the same commit is served from the stored report", async () => {
  const [, { runAnalysisJob }, { getJob, saveReport }] = await load();
  const repositoryUrl = "https://github.com/tracepath/cache-hit";
  saveReport(await reportFor(repositoryUrl, "cafe1234", "cached-token"));
  let analyzeCalls = 0;

  const report = await runAnalysisJob("job-cache-hit", repositoryUrl, {
    resolveHeadCommit: async () => "cafe1234",
    analyze: async () => {
      analyzeCalls += 1;
      throw new Error("a cached commit must not be analyzed again");
    }
  });

  assert.equal(analyzeCalls, 0);
  assert.equal(report.shareToken, "cached-token");
  assert.equal(getJob("job-cache-hit")?.status, "completed");
  assert.equal(getJob("job-cache-hit")?.report?.shareToken, "cached-token");
});

test("a new commit on an already analyzed repository is analyzed again", async () => {
  const [, { runAnalysisJob }, { saveReport }] = await load();
  const repositoryUrl = "https://github.com/tracepath/moved-on";
  saveReport(await reportFor(repositoryUrl, "old-sha", "stale-token"));
  let analyzeCalls = 0;

  const report = await runAnalysisJob("job-cache-miss", repositoryUrl, {
    resolveHeadCommit: async () => "new-sha",
    analyze: async ({ id }) => {
      analyzeCalls += 1;
      return await reportFor(repositoryUrl, "new-sha", `fresh-token-${id}`);
    }
  });

  assert.equal(analyzeCalls, 1);
  assert.equal(report.commitSha, "new-sha");
  assert.equal(report.shareToken, "fresh-token-job-cache-miss");
});

test("a repository whose head cannot be read is still analyzed", async () => {
  const [, { runAnalysisJob }, { saveReport }] = await load();
  const repositoryUrl = "https://github.com/tracepath/unreadable-head";
  saveReport(await reportFor(repositoryUrl, "some-sha", "unused-token"));
  let analyzeCalls = 0;

  await runAnalysisJob("job-no-head", repositoryUrl, {
    resolveHeadCommit: async () => undefined,
    analyze: async () => {
      analyzeCalls += 1;
      return await reportFor(repositoryUrl, "some-sha", "reanalyzed-token");
    }
  });

  assert.equal(analyzeCalls, 1);
});

test("a failed analysis records the failure on the job", async () => {
  const [, { runAnalysisJob }, { getJob }] = await load();
  let analyzeCalls = 0;

  await assert.rejects(
    runAnalysisJob("job-failing", "https://github.com/tracepath/broken", {
      resolveHeadCommit: async () => undefined,
      analyze: async () => {
        analyzeCalls += 1;
        throw new Error("No analyzable text source files were found");
      }
    }),
    /No analyzable text source files were found/
  );

  assert.equal(analyzeCalls, 1);
  assert.equal(getJob("job-failing")?.status, "failed");
  assert.equal(getJob("job-failing")?.error, "No analyzable text source files were found");
});
