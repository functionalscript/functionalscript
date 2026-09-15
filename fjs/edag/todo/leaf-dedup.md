## Deduplicate strings and bigints above a size threshold

**Priority:** P4
**Status:** open

### Problem

A primitive is never shared: the DataJS normalized form writes every
primitive inline, since primitive sharing is not observable and counting
primitives by value would raise the `0`/`-0` and `NaN` questions the
`Object.is` guarantee forbids answering
([`spec/datajs/README.md`](../../../spec/datajs/README.md), normalized form),
and the EDAG analysis ([`analysis.md`](./analysis.md)) counts nodes, not
leaves. That is right for what fits in a machine word. A string or a bigint
does not always fit: a long string repeated in a graph is written out once
per occurrence and held once per occurrence at run time, and a bigint past
the word likewise, where one copy would do and nothing could tell the
difference.

### Proposal

Deduplicate a string or a bigint by value, only when it cannot fit into a
64-bit value: below that size a copy is as cheap as a reference, and a
NaN-boxed VM holds the value inline. Numbers, booleans, `null` and
`undefined` are never deduplicated — they always fit, and the `-0`/`NaN`
questions stay unasked.

- **Where.** A second table in the analysis, beside the shared nodes: the
  strings and bigints above the threshold that occur more than once, each
  once, in evaluation order. Equality is by value, which for a string and a
  bigint is the whole of their identity.
- **The threshold.** A parameter of the analysis, not a constant of the
  graph — a string of more than *n* code units, a bigint of more than 64
  bits — so that a VM with another value representation asks for its own,
  and the FunctionalScript writer, whose reader cannot tell one string from
  a copy, may ask for none. Whatever the default, the analysis over the same
  graph with the same threshold returns the same table, so the outputs stay
  canonical.
- **Consumers.** The memoizing executor holds one value per table entry;
  the writers may hoist an entry as `const $n` where the normalized form
  allows it, which it does not today — writing a primitive inline is a rule
  of the DataJS specification, so hoisting a deduplicated string there is a
  change to that specification first, and the FunctionalScript output can
  decide the same for itself.

### Tasks

- [ ] Decide the default threshold with the VM's value representation in
      hand, and whether the DataJS normalized form admits a hoisted string
      or bigint above it.
- [ ] The analysis's leaf table, parameterized by the threshold, with proofs
      that a short string is never listed, a long one repeated is listed once,
      and a bigint within 64 bits is not.
- [ ] The executor holds one value per entry; the writers hoist per the
      decision above.

### Related

- [`analysis.md`](./analysis.md) — the node table this extends with a leaf
  table.
- [`spec/datajs/README.md`](../../../spec/datajs/README.md) — the normalized
  form's rule that primitives are written inline, which the writer half of
  this depends on changing.
- [`../../../spec/todo/content-addressable-vm.md`](../../../spec/todo/content-addressable-vm.md)
  — where a value is its content, deduplication is the storage, not a pass.
