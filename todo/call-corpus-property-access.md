# Compile call binding and corpus property access

**Priority:** P2
**Status:** wip

### Problem

`edag/value/call` uses a computed numeric index without the compiler's
`Number(...)` spelling. `nanvm/corpus` looks up fixture names through a
computed string property, which requires the existing `entry` helper.
Both are runtime dependency leaves blocked by these accesses.

### Direction

Use the admitted access forms while preserving call binding, fixed/rest
identity, fixture selection and corpus observations. Check each whole module
for any remaining refusals, rename accepted sources to `.f.js`, update their
references and repeat dependency discovery to the rename-only fixed point.

### Tasks

- [ ] Fix and prove the call-binding and corpus accesses.
- [ ] Compile and rename accepted modules; update their references.
- [ ] Refresh the leaf audit, regenerate outputs and run scoped checks.
