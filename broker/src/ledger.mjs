// A deliberately simple, transparent escrow ledger. No real money moves;
// this is a simulated settlement log, clearly labeled as such in the UI.
// Kept in-memory plus mirrored to a JSON file so it's inspectable and
// survives a server restart between demo runs.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEDGER_PATH = path.join(__dirname, "..", "data", "ledger.json");

let entries = [];

async function load() {
  try {
    const raw = await readFile(LEDGER_PATH, "utf8");
    entries = JSON.parse(raw);
  } catch {
    entries = [];
  }
}

async function persist() {
  await mkdir(path.dirname(LEDGER_PATH), { recursive: true });
  await writeFile(LEDGER_PATH, JSON.stringify(entries, null, 2));
}

await load();

export function listEntries() {
  return entries.slice().reverse();
}

export async function openEscrow({ job_id, bounty_usd, requester_origin }) {
  const entry = {
    job_id,
    bounty_usd,
    requester_origin,
    status: "held",
    opened_at: new Date().toISOString(),
    settled_at: null,
    verification: null,
  };
  entries.push(entry);
  await persist();
  return entry;
}

export async function settleEscrow({ job_id, pass, verification }) {
  const entry = [...entries].reverse().find((e) => e.job_id === job_id && e.status === "held");
  if (!entry) return null;
  entry.status = pass ? "released" : "rejected";
  entry.settled_at = new Date().toISOString();
  entry.verification = verification;
  await persist();
  return entry;
}
