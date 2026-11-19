## Extend the flow summary instead of rebuilding it

**Priority:** P2
**Status:** open

### Problem

`functionValue` in [`../module.f.js`](../module.f.js) builds each function's
flow summary as
`mapFromEntries([...mapEntries(context.flows), ...mapEntries(flows(...))])`,
and the lifted-statement case does the same. Every function re-inserts every
entry the summary already holds, so preparation is quadratic in the size of
the program.

Measured on `fjs compile fjs/text/module.f.js out.f.js` after
[`edag/to_fast`](../../../../edag/to_fast/module.f.js) stopped rebuilding its
bound set: preparation is about 30% of the run, and `mapFromEntries` from
this line about 27%.

### Proposal

Set the new entries on `context.flows`, which is persistent, and leave the
entries it holds where they are.

### Tasks

- [ ] Fold the new entries onto the existing summary in both places.
- [ ] Confirm the generated files are unchanged and report the timing.
