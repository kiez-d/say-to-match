// Regression test for sortwell issue #142. The broker's Tier-1
// deterministic sandbox runs this, unmodified, against whatever
// lru.js content a Worker submits as its deliverable.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { LRUCache } = require("../lru.js");

test("LRU cache does not leak internal tracking state beyond capacity", () => {
  const capacity = 16;
  const cache = new LRUCache(capacity);
  for (let i = 0; i < 5000; i++) {
    cache.set("key" + i, i);
    if (i % 3 === 0) cache.get("key" + Math.max(0, i - 1));
  }
  const tracked = cache.internalTrackedCount();
  assert.ok(
    tracked <= capacity * 4,
    `internal tracking state grew unbounded: ${tracked} entries tracked ` +
      `for a capacity-${capacity} cache after 5000 operations`
  );
});

test("LRU cache still evicts correctly (must not regress basic behavior)", () => {
  const cache = new LRUCache(2);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.get("a"); // touch a, so b becomes least-recently-used
  cache.set("c", 3); // should evict b
  assert.strictEqual(cache.get("b"), undefined);
  assert.strictEqual(cache.get("a"), 1);
  assert.strictEqual(cache.get("c"), 3);
});
