## Make numeric indexes explicit

**Priority:** P2
**Status:** wip

### Problem

The SHA-2 compression loop uses numeric cursors to read its round constants
and schedule words. The FunctionalScript compiler requires these computed
keys to use `Number(...)`.

### Tasks

- [ ] Make every numeric key explicit while preserving hash results.
- [ ] Promote the module to `.f.js` if the compiler accepts it.
- [ ] Run generation, type checking and scoped tests and coverage.
