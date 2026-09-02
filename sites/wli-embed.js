/**
 * wli-embed.js — the one-line WebMCP Labor Index injector.
 *
 * Drop this into ANY static page:
 *   <meta name="wli:job" content="...">
 *   <script src="wli-embed.js"></script>
 * or:
 *   <meta name="wli:skill" content="...">
 *   <script src="wli-embed.js"></script>
 *
 * It reads the page's declared Job or Skill and registers real WebMCP
 * tools on document.modelContext (falling back to navigator.modelContext
 * for older builds, per the Chrome 149/150 API migration).
 *
 * If no native WebMCP implementation is present in the browser (i.e. the
 * experimental flag isn't enabled), this file installs a same-surface
 * polyfill so the exact same registerTool()/tool-invocation code path
 * works everywhere. This is what lets the demo run in an unmodified
 * browser: the broker's agent (see broker/src/agent.mjs) drives pages
 * with Playwright and calls these tools directly — it does not care
 * whether the underlying implementation is native or polyfilled, and
 * neither does a real WebMCP-aware agent, since the surface is identical.
 */
(function () {
  "use strict";

  function installPolyfillIfNeeded() {
    if (document.modelContext || navigator.modelContext) return;

    const tools = new Map();

    const polyfill = {
      __isWliPolyfill: true,
      registerTool(spec) {
        if (!spec || !spec.name || typeof spec.execute !== "function") {
          throw new Error(
            "wli-embed: registerTool requires {name, description, inputSchema, execute}"
          );
        }
        tools.set(spec.name, spec);
        console.log(
          "[WebMCP Event] document.modelContext.registerTool('" +
            spec.name +
            "') " +
            JSON.stringify({
              origin: location.origin,
              description: spec.description,
              inputSchema: spec.inputSchema,
            })
        );
        window.dispatchEvent(
          new CustomEvent("wli:tool-registered", { detail: { name: spec.name, spec } })
        );
        return { unregister: () => tools.delete(spec.name) };
      },
      listTools() {
        return Array.from(tools.values()).map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        }));
      },
      async callTool(name, args) {
        const tool = tools.get(name);
        if (!tool) throw new Error("wli-embed: no such tool '" + name + "'");
        console.log(
          "[WebMCP Invocation] " +
            location.origin +
            " tool '" +
            name +
            "' called with " +
            JSON.stringify(args || {})
        );
        const result = await tool.execute(args || {});
        window.dispatchEvent(
          new CustomEvent("wli:tool-invoked", { detail: { name, args, result } })
        );
        console.log(
          "[WebMCP Result] " + location.origin + " tool '" + name + "' returned " +
            JSON.stringify(result)
        );
        return result;
      },
    };

    // Chrome 149-and-earlier surface + Chrome 150+ surface, both pointed
    // at the same polyfill object, matching the fallback pattern real
    // WebMCP integration code is expected to use.
    Object.defineProperty(document, "modelContext", { value: polyfill, configurable: true });
    Object.defineProperty(navigator, "modelContext", { value: polyfill, configurable: true });
  }

  function readDeclaration(kind) {
    // Rich form: <script type="application/json" data-wli="job">{...}</script>
    const rich = document.querySelector('script[type="application/json"][data-wli="' + kind + '"]');
    if (rich) {
      try {
        return JSON.parse(rich.textContent);
      } catch (e) {
        console.error("wli-embed: failed to parse data-wli=" + kind + " JSON block", e);
      }
    }
    // Simple form: <meta name="wli:job" content="...">
    const meta = document.querySelector('meta[name="wli:' + kind + '"]');
    if (meta) {
      return { id: kind + "-" + location.host, description: meta.getAttribute("content") };
    }
    return null;
  }

  function registerJobTools(job) {
    const modelContext = document.modelContext ?? navigator.modelContext;

    modelContext.registerTool({
      name: "wli_inspect_job",
      description:
        "Inspect the task this page is requesting: its natural-language " +
        "requirement, bounty, and verification tier.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => ({
        job_id: job.id,
        description: job.description,
        bounty_usd: job.bounty_usd ?? null,
        verification_tier: job.verification_tier ?? "sandbox_test",
        origin: location.origin,
      }),
    });

    modelContext.registerTool({
      name: "wli_receive_proposal",
      description:
        "Receive a completed deliverable submitted against this job, " +
        "for forwarding to broker verification.",
      inputSchema: {
        type: "object",
        properties: {
          job_id: { type: "string" },
          worker_origin: { type: "string" },
          deliverable: { type: "string" },
        },
        required: ["job_id", "deliverable"],
      },
      execute: async (args) => {
        window.__wliLastProposal = args;
        return { received: true, job_id: args.job_id, forwarded_to_broker: true };
      },
    });

    window.__wliJob = job;
  }

  function registerSkillTools(skill) {
    const modelContext = document.modelContext ?? navigator.modelContext;

    modelContext.registerTool({
      name: "wli_inspect_skill",
      description:
        "Inspect this page's declared capability: what task categories " +
        "it can fulfill, in natural language.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => ({
        skill_id: skill.id,
        description: skill.description,
        provider_kind: skill.provider_kind ?? "unspecified",
        origin: location.origin,
      }),
    });

    modelContext.registerTool({
      name: "wli_submit_proposal",
      description:
        "Submit this worker's deliverable against a matched job for " +
        "broker verification and escrow release.",
      inputSchema: {
        type: "object",
        properties: {
          job_id: { type: "string" },
          deliverable: { type: "string" },
        },
        required: ["job_id", "deliverable"],
      },
      execute: async (args) => {
        window.__wliLastSubmission = args;
        return { submitted: true, job_id: args.job_id, worker_origin: location.origin };
      },
    });

    window.__wliSkill = skill;
  }

  function init() {
    installPolyfillIfNeeded();

    const job = readDeclaration("job");
    const skill = readDeclaration("skill");

    if (job) registerJobTools(job);
    if (skill) registerSkillTools(skill);

    if (!job && !skill) {
      console.warn(
        "wli-embed: no <meta name=\"wli:job\"|\"wli:skill\"> or data-wli JSON block found on this page."
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
