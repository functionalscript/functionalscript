## Bind a tuple's tag by destructuring before dispatching on it

**Priority:** P5
**Status:** open

### Problem

`matchRule` dispatches on `rule[0]`, and `lowerThunk` on `info[0]` and reads
`info[1]` after it, where the style rule prefers a tuple's parts bound by a
pattern before use ([fjs/AGENTS.md](../../../AGENTS.md), "Prefer destructuring
over indexed/property access"). Each case then destructures the payload it
needs, so the tag alone is read by index, once per dispatch. A reviewer
raised it; the maintainer chose to record it rather than change it in the
pull request that shipped the module.

### Proposal

Bind `const [tag] = rule` — or `const [tag, payload] = info` — above each
`switch`, and dispatch on the binding. Behaviour is unchanged; the arity and
carrier checks in each case stay where they are.

### Tasks

- [ ] `matchRule` and `lowerThunk` in [`../module.f.mjs`](../module.f.mjs).
- [ ] `tsc`, `fjs test`.
