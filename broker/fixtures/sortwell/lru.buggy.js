// sortwell's LRU cache, as currently shipped (contains issue #142: a
// memory leak). This is the "before" file the job in sites/requester
// is describing. It exists here purely as ground truth for the demo /
// so the leak is reproducible; the broker verifies against the
// *submitted* deliverable, not this file.
"use strict";

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();
    this._order = []; // intended: tracks access order for eviction
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    this._touch(key);
    return this.map.get(key);
  }

  set(key, value) {
    if (this.map.has(key)) {
      this.map.set(key, value);
      this._touch(key);
      return;
    }
    if (this.map.size >= this.capacity) {
      const oldest = this._order.shift();
      this.map.delete(oldest);
    }
    this.map.set(key, value);
    this._touch(key);
  }

  _touch(key) {
    // BUG: every get()/set() pushes a new entry here, but old duplicate
    // entries for a still-live key are never pruned — only the head of
    // the array is ever removed (on eviction). _order grows without
    // bound under sustained access even though `map` stays capacity-capped.
    this._order.push(key);
  }

  internalTrackedCount() {
    return this._order.length;
  }
}

module.exports = { LRUCache };
