// Reference fix for issue #142, used by the demo's simulated Worker
// agent as the deliverable it submits via wli_submit_proposal. The
// broker treats this as untrusted submitted text like any other
// deliverable — it doesn't get special trust for living in this repo.
"use strict";

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map(); // Map preserves insertion order; reuse that
                           // directly instead of a separate tracking array.
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value); // re-insert to mark as most-recently-used
    return value;
  }

  set(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }
    this.map.set(key, value);
  }

  internalTrackedCount() {
    return this.map.size;
  }
}

module.exports = { LRUCache };
