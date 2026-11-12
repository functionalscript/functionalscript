## Make numeric indexes explicit

**Priority:** P2
**Status:** wip

### Problem

The Base64 and CBase32 decoders use numeric loop cursors in computed string
indexes. The FunctionalScript compiler requires these keys to use `Number(...)`.

### Tasks

- [ ] Make the numeric keys explicit while preserving decoding behavior.
- [ ] Promote each module to `.f.js` if the compiler accepts it.
- [ ] Run generation, type checking and scoped tests and coverage.
