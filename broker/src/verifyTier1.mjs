// Tier 1: deterministic sandbox verification. Real code execution
// against a real (small) regression test suite — no LLM involved, no
// hallucination possible. This is what "P != NP"-style asymmetry buys
// the broker: this whole check costs a few milliseconds of CPU.

import { spawn } from "node:child_process";
import { mkdtemp, writeFile, mkdir, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(__dirname, "..", "fixtures", "sortwell");

export async function runSandboxCheck(deliverableCode) {
  const started = Date.now();
  const sandbox = await mkdtemp(path.join(tmpdir(), "wli-sandbox-"));
  try {
    await mkdir(path.join(sandbox, "tests"), { recursive: true });
    await writeFile(path.join(sandbox, "lru.js"), deliverableCode, "utf8");
    await copyFile(
      path.join(FIXTURE_DIR, "tests", "leak.test.js"),
      path.join(sandbox, "tests", "leak.test.js")
    );

    const result = await new Promise((resolve) => {
      const child = spawn(process.execPath, ["--test", "tests/leak.test.js"], {
        cwd: sandbox,
        timeout: 10_000,
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d));
      child.stderr.on("data", (d) => (stderr += d));
      child.on("close", (code) => resolve({ code, stdout, stderr }));
      child.on("error", (err) =>
        resolve({ code: -1, stdout: "", stderr: String(err && err.message || err) })
      );
    });

    const passMatch = result.stdout.match(/ℹ pass (\d+)/);
    const failMatch = result.stdout.match(/ℹ fail (\d+)/);
    const pass = result.code === 0;

    return {
      pass,
      exit_code: result.code,
      tests_passed: passMatch ? Number(passMatch[1]) : pass ? null : 0,
      tests_failed: failMatch ? Number(failMatch[1]) : pass ? 0 : null,
      duration_ms: Date.now() - started,
      log: (result.stdout + "\n" + result.stderr).trim().slice(-4000),
    };
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
}
