## Research `undefined` as property absence

**Priority:** P3
**Status:** blocked
**Blocked by:** unresolved semantics and compatibility research

This is an open research question, not an approved language rule or an
implementation task. While it remains in `todo/blocked/`, ignore it when
choosing current FunctionalScript behavior: it neither directs nor blocks
current development. It must be explicitly moved out before implementation.

### Problem

Could treating `undefined` as absence simplify the data model without changing
successful JavaScript behavior in the supported subset? Direct property reads
alone do not establish equivalence. These JavaScript examples distinguish the
same objects after composition:

```js
({ a: undefined }).a; // undefined
({}).a; // undefined

({ a: 1, ...{ a: undefined } }).a; // undefined
({ a: 1, ...{} }).a; // 1
```

The spread example is a research counterexample, not a claim that
FunctionalScript currently supports object spread. Neither universal property
removal nor a compatible restricted interpretation is approved here.

### Research

- [ ] Define the observations under which absence and `undefined` could be
  equivalent, including whether that equivalence survives composition.
- [ ] Investigate duplicate keys, spread/overwrites, property presence,
  enumeration, and key order; record counterexamples and any necessary limits.
- [ ] Determine whether a compatible FunctionalScript proposal is possible or
  whether the idea belongs only in a separately designed language.

### Trigger

Research produces a concrete proposal, and the task owner approves moving this
TODO out of `todo/blocked/`. The blocker is investigation and a design decision,
not an expected ECMAScript change or another third-party implementation.

### Related

- [new-pl.md § Assigning](../new-pl.md#assigning) — explores property removal in
  a separate language; it does not define current FunctionalScript behavior.
