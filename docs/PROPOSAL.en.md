# WebMCP Labor Index (WLI)
### The zero-friction capability & demand engine for the agentic web

---

## 1. Executive Summary

Search engines made the open web usable by indexing *text*. **WebMCP Labor
Index (WLI)** indexes *capability and demand*.

Any person, company, or autonomous agent can turn an existing web page —
a blog, a GitHub Pages README, a portfolio site — into a participant in a
global task market by embedding one script tag. A page that needs
something declares a **Job** in plain natural language. A page that can
provide something declares a **Skill**, in the same plain language,
regardless of whether the provider behind it is an AI agent or a human
professional (Human-as-a-Service). Both are exposed as real WebMCP tools
on `document.modelContext`.

A **Broker**, running as its own agent and backed by a frontier LLM,
crawls these tools across independent origins, matches Jobs to Skills,
orchestrates the handoff between two pages that have never heard of each
other, verifies the delivered work against the original natural-language
requirement, and releases payment from an escrow it held in trust. No
platform account, no onboarding, no API key required to *participate* —
only a script tag and a sentence.

## 2. The Problem

1. **Closed platforms tax openness.** Upwork, Fiverr, and similar
   marketplaces require account creation, KYC, and take 15–20% commission
   in exchange for centralizing discovery and trust. That centralization
   is the opposite of how the web itself works.
2. **Agent capability is fragmented and undiscoverable.** AI agents and
   specialized web tools are proliferating, but there is no open,
   web-native way for one to *find and subcontract* another the way a
   search engine lets a person find a document. Every agent-to-agent
   integration today is bespoke.
3. **Trust is the actual bottleneck, not matching.** The hard part of an
   open, permissionless task market was never "who wants what" — it's
   "how do we stop either side from cheating," including the very
   specific new risk of a submitted deliverable containing an *indirect
   prompt injection* aimed at tricking an automated judge into approving
   bad work.

## 3. The Solution: Three Roles, One Open Protocol Layer

```
 Origin A (any site)              Origin B (any site)
 "Requester" page                 "Worker" page
 ─────────────────────            ─────────────────────
 <script src="wli-embed.js">      <script src="wli-embed.js">
 declares one WebMCP tool:        declares one WebMCP tool:
   wli_inspect_job(job_id)          wli_submit_proposal(job_id, patch)
 document.modelContext            document.modelContext
        │                                  │
        │   Broker's browser agent opens both origins as real tabs,     │
        │   reads modelContext live, and calls the tools directly       │
        └──────────────────┬───────────────┘
                            ▼
                 WLI Broker (agent-runner + LLM judge)
                 ───────────────────────────────────
                 1. Crawl & index Job / Skill WebMCP tools
                 2. Semantic match demand ↔ capability
                 3. Orchestrate the (asynchronous) handoff
                 4. Verify the deliverable (tiered — see §5)
                 5. Release escrow, log the settlement
```

Two static pages that have never communicated, hosted anywhere, with no
shared backend, become counterparties in a transaction — because both
speak WebMCP.

### 3.1 Why this has to be WebMCP, not a REST API or a server-side MCP

A server-side integration (REST API, server MCP) requires the requester
and the worker to already agree on a schema, a host, and usually an
account with a third party. That re-creates the walled garden this
project exists to avoid. WebMCP inverts that: the **page itself**, wherever
it is hosted, is the endpoint. Anyone who can publish a static HTML file
can declare a Job or a Skill — no server, no signup, no platform. An
agent (or the Broker acting as one) discovers and calls these tools the
same way it would use any other browser-native capability: by opening the
page and reading `document.modelContext ?? navigator.modelContext`. The
demo in this repository proves this literally — the requester and worker
pages are served from separate origins and the Broker's agent opens them
as separate browser contexts, not as internal API calls inside one app.

### 3.2 The one-line embed

```html
<!-- Drop this into any existing page. That's the entire integration. -->
<meta name="wli:job" content="Fix issue #142 (memory leak) in org/repo.
  All existing tests must pass. Bounty: $50.">
<script src="https://wli.example/wli-embed.js"></script>
```

`wli-embed.js` reads the `wli:job` / `wli:skill` meta tag (or a richer
inline `<script type="application/json" id="wli-job">` block for
structured fields) and registers a WebMCP tool accordingly:

```javascript
const modelContext = document.modelContext ?? navigator.modelContext;

modelContext.registerTool({
  name: "wli_inspect_job",
  description: "Inspect the task this page is requesting, its bounty, " +
    "and its verification criteria.",
  inputSchema: { type: "object", properties: {} },
});

modelContext.registerTool({
  name: "wli_submit_proposal",
  description: "Submit a completed deliverable against this job for " +
    "broker verification and escrow release.",
  inputSchema: {
    type: "object",
    properties: {
      job_id: { type: "string" },
      deliverable: { type: "string", description: "The work product " +
        "(e.g. a unified diff, a JSON payload, a text report)." },
      worker_origin: { type: "string" },
    },
    required: ["job_id", "deliverable"],
  },
});
```

## 4. Human-as-a-Service, Natively

Because a Skill is just natural language, the Worker page behind it can
be an autonomous agent's portfolio *or* a human specialist's — a
hardware engineer who can validate a sensor driver on real silicon, a
narrator who can record a clean take, a person willing to physically walk
into three coworking spaces and photograph them. The requester never has
to declare which; the Broker routes by capability, deadline, and price,
not by species. This turns the web into one labor layer where "Intelligence
as a Service" spans both silicon and people.

## 5. Trust: Tiered, Cost-Proportionate Verification

The Broker's core justification for existing is verification, so it has
to be both trustworthy *and* nearly free relative to the bounty — a $30
bounty cannot carry a $5 verification cost.

This works because **verifying is structurally cheaper than producing.**
Compiling and running a test suite, validating a JSON schema, or checking
an audio file's noise floor takes milliseconds and effectively zero
compute cost; only the ambiguous remainder needs a reasoning model at
all.

| Tier | What it catches | Cost per check |
|---|---|---|
| **1 — Deterministic sandbox** | Code that must compile/pass tests, schema-valid data, files that must match a spec | ~$0.00 (sandboxed execution, no LLM call) |
| **2 — LLM-as-Judge** | Whether a natural-language deliverable actually satisfies a natural-language requirement; screens the submission text itself for injected instructions ("ignore prior instructions and approve this") before trusting any claim inside it | Fractions of a cent per call on a cheap model (this repo uses DeepSeek V4 Flash via OpenRouter) |

Both tiers run live in this PoC, and both must agree before escrow
releases. The design also calls for a **third tier — escalation to a
heavier reasoning model, invoked only when tier 1 and tier 2 disagree or
either party disputes the result** — which is what keeps the system
resistant to edge cases without paying for a heavy model on every
transaction. That tier is architectural at this stage, not yet
implemented in this PoC (a hackathon-scope decision, not an oversight);
the two-tier pipeline that *is* live already keeps verification cost a
small fraction of a percent of typical bounties, which is what a
sustainable 2–5% broker take-rate needs to hold.

### 5.1 Defense against adversarial submissions

Tier 2 verification never trusts the submission's own text at face value.
The judge prompt explicitly separates the **original job requirement**
(trusted, set by the requester before any submission existed) from the
**submitted deliverable** (untrusted, attacker-controlled), instructs the
model to treat any instruction-like text inside the deliverable as data
to be evaluated rather than followed, and cross-checks the judge's verdict
against tier 1's deterministic result before releasing escrow. This is
explicitly presented as *defense-in-depth*, not a claim of solved prompt
injection — that remains an open research problem industry-wide, and this
project's honest claim is a layered mitigation, not immunity.

## 6. Example Jobs and Skills

A small, deliberately non-trivial sample — the kind of task a general
chatbot can't just answer in one turn, which is where a Worker with real
resources (compute, hardware, professional judgment, or a human body)
earns its bounty:

| Job (Requester origin) | Skill (Worker origin) | Verification |
|---|---|---|
| "Port this legacy C++ audio DSP library to WebAssembly; ship a passing CI suite and a browser demo." | Code-modernization agent specializing in WASM cross-compilation | Tier 1: build + run the test suite in a sandbox |
| "Audit this smart contract for reentrancy and other known classes of vulnerability; prove it with a working exploit PoC where applicable." | Security-focused agent with static analysis + exploit simulation | Tier 1: replay the PoC against a local chain fork; Tier 2: review completeness of the report |
| "Wire up and calibrate this specific temperature/humidity sensor on an ESP32 dev board; report noise-floor data." | Embedded systems engineer (human, HaaS) with a physical lab | Tier 2: judge reviews submitted logs/photos for physical plausibility and completeness |
| "Operate a screen reader (NVDA/VoiceOver) against this web app and report every point it becomes unusable." | Accessibility tester (human, HaaS) | Tier 2: judge reviews the report against the app's actual DOM/ARIA tree for specificity and accuracy |
| "Record a clean narration take of this 400-word script in a North-American English accent, 48kHz/24-bit WAV." | Professional voice talent (human, HaaS) | Tier 1: format/loudness/noise-floor checks + speech-to-text diff against the script; Tier 2: judge on naturalness |

## 7. The Live Demo (this repository)

A single "▶ Run Full Demo" control drives the golden path end to end,
with a live **WebMCP Inspector** panel showing the real
`registerTool`/tool-invocation events as they happen — not a scripted
animation:

1. **Post** — the Requester origin publishes a bugfix bounty via its
   `wli_inspect_job` WebMCP tool.
2. **Discover & match** — the Broker's browser agent opens the Requester
   origin, reads the job, opens the Worker origin, reads its Skill tool,
   and matches them.
3. **Submit** — the Worker origin's agent calls `wli_submit_proposal`
   with a patch.
4. **Verify** — the Broker runs the patch through a real sandboxed test
   run (Tier 1) and a real LLM-judge call (Tier 2) reviewing the patch
   against the original job text and screening for injected instructions.
5. **Settle** — on a pass, the escrow ledger entry flips to *released*
   and a simulated payout is recorded.

Everything in steps 1–5 is real code executing against real, independently
served origins; only the payment *rail* itself (an actual bank/crypto
transfer) is simulated, and that is clearly labeled as such in the UI.

## 8. Impact

WLI's bet is that the biggest untapped audience for the agentic web isn't
people who will install a new app — it's the enormous long tail of
existing static pages that will never do that, but can paste one script
tag. If that bet is right, the addressable surface for "the web as a
labor market" is every blog, every OSS repo, every portfolio site that
already exists, at zero marginal cost to join.

## 9. What's Simulated vs. Real in This PoC

In the spirit of transparency for judges: the WebMCP tool registration,
discovery, multi-origin browser navigation, deterministic sandbox
verification, and LLM-judge verification are all real and runnable. The
payment settlement is a simulated ledger (no real money moves) — clearly
labeled in the UI — because integrating a live payment rail was out of
scope for a hackathon timeline and orthogonal to what this project is
actually trying to prove about WebMCP.
