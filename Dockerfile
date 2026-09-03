# Runs the whole WLI demo stack in one container: the broker dashboard
# (:3000) and the two independent-origin static sites (:3001, :3002) —
# see broker/src/server.mjs, which already serves all three from one
# Node process. This is a convenience add-on for judges who want to run
# and inspect the project locally; the required live URL (see README)
# is the primary way to access it, not a replacement for one.
#
# Microsoft's official Playwright image ships a matching Chromium build
# with every system library pre-installed correctly — no library-
# hunting workarounds needed (unlike this repo's own dev sandbox, which
# had no root and had to assemble those by hand).
# Pin the tag to the exact Playwright version in broker/package-lock.json
# (`npm ci` below installs that exact version) so the bundled browser
# build matches what the `playwright` npm package expects.
FROM mcr.microsoft.com/playwright:v1.62.1-jammy

# A couple of Latin fonts so any rendered/recorded output looks right;
# not required for the tool-call logic itself (that's headless JS
# execution, not pixel-dependent), just for visual polish.
RUN apt-get update \
  && apt-get install -y --no-install-recommends fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy just the manifest first so `npm ci` is Docker-layer-cached across
# rebuilds that don't touch dependencies.
COPY broker/package.json broker/package-lock.json ./broker/
RUN cd broker && npm ci --omit=dev

# Now the rest of the repo (sites/, broker/src, broker/public,
# broker/fixtures, demo/ — server.mjs reads sites/ and demo/render/ via
# relative paths from broker/src, so the on-disk layout must mirror the
# repo exactly).
COPY . .

EXPOSE 3000 3001 3002

# No .env is baked in (never bake secrets into an image layer). Without
# OPENROUTER_API_KEY set, verifyTier2.mjs's judge runs in its
# already-verified deterministic mock mode — the demo still runs
# correctly end to end, just without a live LLM call. Pass a key at
# `docker run` time with `-e OPENROUTER_API_KEY=...` to use a real one.
CMD ["node", "broker/src/server.mjs"]
