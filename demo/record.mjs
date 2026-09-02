// Records the actual demo dashboard while driving it through the golden
// path (clean run) and then the adversarial run, pacing the pauses to
// match demo/render/segment_plan.json (built from the real narration
// clip durations by build_audio.py) so the picture and the narration
// land close together once muxed.
import { chromium } from "playwright";
import { readFile, rename, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = path.join(__dirname, "render");
const DASHBOARD = process.env.DASHBOARD_URL || "http://localhost:3000";
const INTRO = process.env.INTRO_URL || "http://localhost:3000/intro.html";

const plan = JSON.parse(await readFile(path.join(RENDER_DIR, "segment_plan.json"), "utf8"));
const wait = (seg) => new Promise((r) => setTimeout(r, (seg.duration + seg.gap) * 1000));

async function clickRunFullDemo(page) {
  await page.click("#run-clean");
}
async function clickRunAdversarial(page) {
  await page.click("#run-adv");
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  recordVideo: { dir: RENDER_DIR, size: { width: 1280, height: 800 } },
  viewport: { width: 1280, height: 800 },
});
const page = await context.newPage();

console.log("Opening intro animation...");
await page.goto(INTRO, { waitUntil: "load" });

// seg01: the systemic-risk framing (AI unemployment) — plays over the
// intro animation's "excluded worker" motif
await wait(plan[0]);
// seg02: the mitigation framing ("what we built" keeps the door open)
await wait(plan[1]);
// seg03: the three-role explanation — plays over the animated
// Requester/Broker/Worker diagram drawing itself in
await wait(plan[2]);
// seg04: "here's what that looks like, running live" -> cut to the dashboard
await wait(plan[3]);

console.log("Opening dashboard...");
await page.goto(DASHBOARD, { waitUntil: "load" });

// seg05: describe requester (left)
await wait(plan[4]);
// seg06: describe worker (right)
await wait(plan[5]);
// seg07: "watch when we click Run Full Demo" -> click at the end of this beat
await wait(plan[6]);
console.log("Clicking Run Full Demo...");
await clickRunFullDemo(page);
// seg08: the run itself / "how we used WebMCP" (discovery, matching)
await wait(plan[7]);
// seg09: submit, verify (tier1 + tier2)
await wait(plan[8]);
// seg10: "it passes, escrow released"
await wait(plan[9]);
// seg11: "now watch an adversarial submission" -> click at the end
await wait(plan[10]);
console.log("Clicking Run Adversarial Demo...");
await clickRunAdversarial(page);
// seg12: broker judge not fooled
await wait(plan[11]);
// seg13: outro / "that's what we built"
await wait(plan[12]);

console.log("Closing (finalizing video)...");
await context.close();
await browser.close();

// Playwright names the video by an internal hash; find the newest one
// (by mtime) and give it a stable name.
const files = (await readdir(RENDER_DIR)).filter((f) => f.endsWith(".webm"));
const withMtime = await Promise.all(
  files.map(async (f) => ({ f, mtime: (await stat(path.join(RENDER_DIR, f))).mtimeMs }))
);
withMtime.sort((a, b) => b.mtime - a.mtime);
const newest = withMtime[0].f;
const target = path.join(RENDER_DIR, "dashboard-capture.webm");
await rename(path.join(RENDER_DIR, newest), target);
console.log("Video saved to", target);
