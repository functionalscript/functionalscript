## `toSorted` with an inconsistent comparator is engine-defined

**Priority:** P4
**Status:** open

### Problem

`allowedCalls` admits a name only when it is "pure, specified exactly, and the
same on every engine". `toSorted` is, for a comparator that is consistent and
does not throw. For one that is not consistent (`() => 1`), ECMAScript leaves
the order to the engine, and with it the sequence of comparisons: which of two
elements the comparator is handed first. In a pure language that sequence is
observable only through which throw surfaces, but it is observable:
`[{}, null].toSorted((a, b) => a.x)` throws on V8, which calls the comparator
with `null` first, and answers on NaNVM, whose merge sort calls it with `{}`
first.

NaNVM does not detect an inconsistent comparator, since detecting one needs
every pair compared; it answers what its stable merge sort answers
(`nanvm-lib/src/vm/array/README.md`). The shared corpus pins only comparators
whose answer does not depend on the order.

### Proposal

A language-design question, open: document it and leave `toSorted` allowed, as
now; specify one algorithm every engine follows; or refuse a comparator
argument. The row for `toSorted` in [`../README.md`](../README.md) records the
state today.
