## Research `undefined` as property absence

**Priority:** P3
**Status:** blocked
**Blocked by:** unresolved semantics and compatibility research

This is an open research question, not approval to change language or VM
behavior. While it remains in `todo/blocked/`, ignore it when choosing current
FunctionalScript behavior: it neither directs nor blocks current development.
It must be explicitly moved out before implementation.

### Scope

[Undefined properties](../../spec/todo/1010-undefined-property.md) already
states the language-level equivalence and restricts observations: `in` and bare
`Object.entries`/`Object.values` are prohibited; the documented filtered patterns
are permitted. This TODO neither revokes nor extends those restrictions. Its
blocked status applies to this research, not to those specification documents.

[The VM-layer question](../../spec/todo/1015-undefined-property-vm-layer.md)
separately leaves the representation decision unresolved. This TODO does not
settle it or authorize construction-time removal of `undefined`-valued entries.

### Problem

Can that language-level equivalence extend to more operations or to the VM
representation without changing successful JavaScript behavior in the supported
subset? Direct property reads alone do not establish equivalence. These
JavaScript examples distinguish the same objects after composition:

```js
({ a: undefined }).a; // undefined
({}).a; // undefined

({ a: 1, ...{ a: undefined } }).a; // undefined
({ a: 1, ...{} }).a; // 1
```

The spread example is a research counterexample, not a claim that
FunctionalScript currently supports object spread. Equal direct reads do not
prove equivalence under every composition; this TODO approves no additional
rule or restriction.

### Research

- [ ] Check the existing language-level restrictions and any proposed extensions
  against composition; record where the equivalence holds or fails.
- [ ] Investigate duplicate keys, spread/overwrites, property presence,
  enumeration, and key order; record counterexamples and any necessary limits.
- [ ] Determine whether an extension is compatible with FunctionalScript or
  belongs only in a separately designed language.

### Trigger

Research produces a concrete proposal, and the task owner approves moving this
TODO out of `todo/blocked/`. The blocker is investigation and a design decision,
not an expected ECMAScript change or another third-party implementation. This
is the named [research exception](../README.md#research-exception) to the
usual `todo/blocked/` classification.

### Related

- [new-pl.md § Assigning](../new-pl.md#assigning) — explores property removal in
  a separate language; it does not define current FunctionalScript behavior.
