## corpus-as-conformance-vectors. Run the corpus's EDAG expressions on both executors

**Priority:** P3
**Status:** open

### Problem

Every case in [`fjs/nanvm/`](../README.md) now denotes an EDAG expression:
`caseExp`/`lowerEq` in [`module.f.mjs`](../module.f.mjs) derive it, the proof
validates it against the [`fjs/edag`](../../edag/README.md) schema and
evaluates it, and [`rust/module.f.mjs`](../rust/module.f.mjs) prints it. That
makes the corpus the "conformance examples (test vectors) shared by the FJS and
Rust implementations" that
[edag-spec](../../../todo/edag-spec.md) asks for — in *authoring*. In
*execution* it is not yet: each side still runs the case through its own
operator, and no executor consumes the expression as a value.

Two things are missing, both waiting on work outside this directory.

**`nanvm-lib` never sees the expression.** The roadmap's interpreter executes
"the `Any` described by the EDAG spec"
([mvp-roadmap](../../../nanvm-lib/todo/mvp-roadmap.md)), and the derived case
expressions are exactly such values — but there is no transport. The roadmap
defers generic `Any` serialization to post-MVP, and this repository's
cross-language bridge is generated Rust, so until the interpreter exists there
is nothing to hand them to.

**Three operators the roadmap needs are uncovered.** `&&`, `||`, and `??` are
already in `op2Id`, with laziness that is positional rather than nodal, so
they need no new node kind — only cases.

### Proposal

**The lazy operators.** Add `Group2`s for `&&`, `||`, and `??` pinning their
*value* results. With constant operands a case cannot observe
non-establishment, so that half waits: once `['throw', exp]` is in the schema
(the stage-1 discussion's node, not the corpus's `throws` marker, which
describes an outcome and never appears in an expression), a case whose lazy
operand is a `['throw', …]` proves the operand was not established. Until
`nanvm-lib` implements the three, every case carries a `rust` reason and the
generated file keeps it as a commented-out `TODO` — the corpus's ordinary way
of recording a gap.

**The transport.** When the interpreter lands, the printer grows a second
output beside the direct-operator statements it prints today: one that
*constructs* each derivable case's expression as an `Any` and hands it to the
interpreter. Authoring stays single-source; only the transport is generated.
Once the deferred `Any`/CBOR serialization exists, the same expressions can
ship as serialized data instead. Either way this is what keeps the interpreter
and the generated code in agreement — the point the roadmap's test-generation
item makes — and the JavaScript side's counterpart is replacing the proof's
inline evaluator with the EDAG interpreter
([interpret-edag](../../djs/todo/interpret-edag.md)), which owes the same
identity-memoization contract the corpus already relies on.

### Tasks

- [ ] Add `&&`, `||`, and `??` groups with their value results, each case
      carrying a `rust` reason until `nanvm-lib` implements the operator.
- [ ] Add non-establishment cases once `['throw', exp]` is in the schema.
- [ ] Replace the proof's inline evaluator with the `interpret-edag`
      interpreter when it lands, and register the corpus as its test suite.
- [ ] Extend the printer to construct each case's expression as an `Any` and
      hand it to the `nanvm-lib` interpreter (serialized `Any` once the
      roadmap's post-MVP serialization exists).
- [ ] Register the corpus as the shared conformance vectors of
      [edag-spec](../../../todo/edag-spec.md).
- [ ] `npx tsc`, `fjs test`, `npm run ci-update`, `cargo test`,
      `cargo clippy -- -D warnings`, and `cargo fmt -- --check`.

### Related

- [`../README.md`](../README.md) — "The operations come from EDAG": what the
  corpus already derives, validates, and shares.
- [`../../../todo/edag-spec.md`](../../../todo/edag-spec.md) — the shared
  conformance test vectors this completes.
- [`../../../nanvm-lib/todo/mvp-roadmap.md`](../../../nanvm-lib/todo/mvp-roadmap.md)
  — the interpreter and remaining-operators items this feeds.
- [`../../djs/todo/interpret-edag.md`](../../djs/todo/interpret-edag.md) — the
  FunctionalScript executor that replaces the proof's inline evaluator.
- [`../../../todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
  — positional laziness, and the future `throw` node the non-establishment
  cases need.
- [`./unify-eq-into-a-group.md`](./unify-eq-into-a-group.md) — the one section
  of the corpus that is not yet an ordinary group.
