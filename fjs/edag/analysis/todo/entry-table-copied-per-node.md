## Add an entry without copying the table

**Priority:** P2
**Status:** open

### Problem

`entry` in [`../module.f.js`](../module.f.js) answers a new node's table as
`[...entries, { scope, node }]`: every node copies every entry before it, and
where the walk merges, `entries.findIndex(twin(scope, node))` scans them all
first. The analysis is quadratic in the number of nodes.

Measured at `9501145`, on `fjs compile fjs/compiler/edag/module.f.js out.f.js`,
a run of about 66 s under Node 22: `entry` is about 16% of the run by itself,
and the walk around it about 18%. The figures under Related are from the same
run.

### Proposal

Collect the entries in a structure an append shares, a list or a persistent
map, and build the array once when the walk ends. Find a twin by a key the
structure looks up instead of by a scan.

### Tasks

- [ ] Append without copying, and look a twin up without scanning.
- [ ] Confirm the generated files are unchanged and report the timing.

### Related

- [`../../to_fast/module.f.js`](../../to_fast/module.f.js) — what remains
  there on the same run: `reachable` at about 16% and `demandsInOrder`, which
  establishes every bound value on each call, at about 11%.
