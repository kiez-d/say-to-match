import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EventEmitter } from "node:events";
import dotenv from "dotenv";
import { orchestrateDemo } from "./agent.mjs";
import { listEntries } from "./ledger.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");
// The shared .env lives at the repo root (one secret, documented once in
// PROGRESS.md), not inside broker/ — load it explicitly rather than
// relying on dotenv's process.cwd()-relative default.
dotenv.config({ path: path.join(REPO_ROOT, ".env") });
const SITES_DIR = path.join(REPO_ROOT, "sites");
const EMBED_FILE = path.join(SITES_DIR, "wli-embed.js");

const BROKER_PORT = process.env.BROKER_PORT || 3000;
const REQUESTER_PORT = process.env.REQUESTER_PORT || 3001;
const WORKER_PORT = process.env.WORKER_PORT || 3002;
// Public URLs for the two origins. Locally these default to localhost on
// their own ports. In a real deployment, the requester and worker sites
// would typically be hosted on entirely different domains — set
// REQUESTER_URL/WORKER_URL to those and agent.mjs (which reads the same
// env vars) will drive the real deployed origins instead of localhost.
const REQUESTER_URL = process.env.REQUESTER_URL || `http://localhost:${REQUESTER_PORT}`;
const WORKER_URL = process.env.WORKER_URL || `http://localhost:${WORKER_PORT}`;

const bus = new EventEmitter();
bus.setMaxListeners(50);
let running = false;

// --- Two genuinely independent static origins ----------------------------
// Each is its own HTTP server on its own port. From a browser's (and
// WebMCP's) perspective these are as separate as two different domains
// would be — a real deployment would put them on different hostnames
// entirely; running them from one process here is purely a convenience
// for a one-command local demo.
function makeSiteServer(siteDir) {
  const app = express();
  app.get("/wli-embed.js", (_req, res) => res.sendFile(EMBED_FILE));
  app.use(express.static(siteDir));
  return app;
}

makeSiteServer(path.join(SITES_DIR, "requester")).listen(REQUESTER_PORT, () =>
  console.log(`[requester origin] http://localhost:${REQUESTER_PORT}`)
);
makeSiteServer(path.join(SITES_DIR, "worker")).listen(WORKER_PORT, () =>
  console.log(`[worker origin]    http://localhost:${WORKER_PORT}`)
);

// --- Broker dashboard + API -------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/config", (_req, res) => res.json({ requesterUrl: REQUESTER_URL, workerUrl: WORKER_URL }));

app.get("/api/ledger", (_req, res) => res.json(listEntries()));

app.get("/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  const onEvent = (evt) => res.write(`data: ${JSON.stringify(evt)}\n\n`);
  bus.on("event", onEvent);
  req.on("close", () => bus.off("event", onEvent));
});

app.post("/api/run-demo", async (req, res) => {
  if (running) return res.status(409).json({ error: "A demo run is already in progress." });
  running = true;
  const adversarial = Boolean(req.body?.adversarial);
  bus.emit("event", { type: "run_start", message: `Starting ${adversarial ? "adversarial" : "clean"} demo run…`, at: new Date().toISOString() });
  try {
    const result = await orchestrateDemo({
      adversarial,
      videoDir: path.join(REPO_ROOT, "demo", "render"),
      emit: (evt) => bus.emit("event", evt),
    });
    bus.emit("event", { type: "run_end", message: "Demo run finished.", data: result, at: new Date().toISOString() });
    res.json(result);
  } catch (err) {
    const message = `Demo run failed: ${err.message}`;
    bus.emit("event", { type: "run_error", message, at: new Date().toISOString() });
    res.status(500).json({ error: message });
  } finally {
    running = false;
  }
});

app.listen(BROKER_PORT, () => {
  console.log(`[broker dashboard] http://localhost:${BROKER_PORT}`);
  console.log(`OpenRouter judge model: ${process.env.OPENROUTER_MODEL || "(unset — mock mode)"}`);
});
