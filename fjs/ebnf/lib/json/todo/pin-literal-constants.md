## Pin the grammar's literal constants

**Priority:** P4
**Status:** open

### Problem

Two literals in the JSON grammar are declared without a `const` pin, so
TypeScript widens them where the rules that embed them keep their precision:

- `hex` — an object literal, whose properties widen to mutable.
- the `number` array — widens to a mutable array rather than a tuple, losing
  its arity.

Both end up inside exported rules, so the imprecision is in the emitted
declaration rather than local to the file. Pinning is the repository's standing
rule for literal `const`s
([fjs/AGENTS.md §3.2](../../../../AGENTS.md)), and every other literal in this
module already carries the pin, which is what makes these two read as an
oversight rather than a decision.

Nothing is wrong at runtime, and no rule the grammar builds changes shape —
this is type precision, hence the priority.

### Proposal

Pin both with `/**@type {const}*/`, matching the neighbouring declarations.

### Tasks

- [ ] Pin `hex` and the `number` array.
- [ ] Check the emitted declarations keep the tuple shapes the rules carry.

### Related

- [`../module.f.mjs`](../module.f.mjs) — the two declarations.
- [fjs/AGENTS.md](../../../../AGENTS.md) — "Pin literal `const`s", and the
  `const` type parameter rule that covers the argument side.
