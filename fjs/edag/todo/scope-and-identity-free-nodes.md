## Should the scope rule reach a node that mints nothing?

**Priority:** P3
**Status:** open

### Problem

[`analysis`](../analysis/module.f.mjs) refuses a node reached from two
scopes — `a node shared across a function boundary` — and the refusal is
structural: it asks where a node is reached from, never what the node is.

For a node that mints identity the rule is the design
([`../execution-models.md`](../execution-models.md)): `['[]', []]` inside a
body is a fresh array per call and outside it is one array, so a graph that
puts the same node in both places says two things at once and is no EDAG.

For a node that mints nothing the rule has nothing to protect. `['undefined']`
has no operands and denotes one value; reached from a body and from the
module alike, it is the same `undefined` either way, and nothing about it is
evaluated per call. The analysis merges two such nodes within a scope for
exactly that reason — they are indistinguishable — and then refuses the same
two across a boundary.

That asymmetry cost a crash. `fjs/fsc/edag` kept `['undefined']` as a
module-level constant and returned it for every occurrence, so
`export default [undefined, (...a) => undefined];` — source the parser
accepts and the writer spells — linked to a graph whose analysis threw. The
linker now builds a node per occurrence
([`fjs/fsc/edag/module.f.mjs`](../../fsc/edag/module.f.mjs)), which is the
smaller fix and the one that keeps the analysis's contract as written and
proved. It is not obviously the *right* fix.

### Proposal

Answer the question the crash raised, one way or the other, and write the
answer where the rule is stated:

1. **The rule stands as it is.** A scope is a property of a node, not of
   what the node denotes, and a linker that shares an identity-free node
   across a boundary is simply wrong — the same way it would be wrong to
   share an `['args']`. Then the fix already made is the whole answer, and
   this document says so and is deleted. Every future producer of an EDAG
   owes the same care, which is worth one sentence in
   [`../execution-models.md`](../execution-models.md) rather than being
   learned from a throw.
2. **The rule is about identity.** An identity-free node with no operands
   is admitted in any number of scopes, and the analysis gives it an entry
   per scope, exactly as though the producer had built one per occurrence.
   Then a producer cannot get this wrong, the FunctionalScript writer needs
   no rule about it, and the refusal narrows to what it is for. The cost is
   that `scope` stops being a function of the node and the walk has to
   duplicate rather than reject, which is a change to the table's own
   contract and to the proofs that pin it.

The question generalizes past `undefined`: every `Op0` is identity-free, and
`['args']` is one — but `args` is not the same value in two scopes, so it is
the counterexample that keeps (2) from being "identity-free" and makes it
"identity-free **and** denoting the same value everywhere". Whether that
class is worth naming, or is only ever `['undefined']`, is part of the
answer.

### Tasks

- [ ] Decide between the two, in `../execution-models.md`.
- [ ] If (1): state the producer's obligation there, and delete this file.
- [ ] If (2): the walk duplicates rather than throws, the analysis proof's
      `throw` cases narrow to identity-minting nodes, and the linker's
      per-occurrence node becomes an optimization rather than a correctness
      fix.

### Related

- [`analysis.md`](./analysis.md) — the table the rule lives in.
- [`../execution-models.md`](../execution-models.md) — where a scope is
  defined, and where the answer belongs.
- [`fjs/fsc/serializer`](../../fsc/serializer/module.f.mjs) — the writer
  whose round trip met the crash.
