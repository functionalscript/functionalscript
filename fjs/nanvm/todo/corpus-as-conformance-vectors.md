## corpus-as-conformance-vectors. Run the corpus's EDAG expressions on both executors

**Priority:** P3
**Status:** open

### Problem

Every case in [`fjs/nanvm/`](../README.md) now denotes an EDAG expression:
`caseExp` in [`module.f.mjs`](../module.f.mjs) derives it, the proof
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

### A nested operation does not yet print as compilable Rust

An operation nested in an eager position — `['*', 1, ['*', 2, 3]]` — does
not print as compilable Rust for the corpus; a lazy position is the one
exception, below.

Every `nanvm-lib` operator returns `Result<Any<A>, Any<A>>`:

```rust
impl<A: IVm> Mul for Any<A> {
    type Output = Result<Any<A>, Any<A>>;
```

`check` takes that `Result` at the top of a statement, which is why every flat
case compiles. An operation nested as an operand hands the outer one a
`Result` where it needs an `Any`, so `['*', 1, ['*', 2, 3]]` prints as
`f64_any(0x3ff0000000000000) * (f64_any(0x4000000000000000) * f64_any(0x4008000000000000))`
and fails to compile
with E0308.

Grouping is already right — an operation nested as an operand is
parenthesized, so the printed text is the tree the node is, and
`nestedOperation` in [`../rust/proof.f.mjs`](../rust/proof.f.mjs) pins that.
What is missing is propagation. No corpus case reaches it today: a case is one
operation over lowered values, and the one operation a value lowers to,
`unreached`, sits in a lazy position, so `generated.rs` nests nothing in an
eager one and `cargo test` has never had the chance to fail. The exported
`nodeExpr` does reach it —
it takes an arbitrary `Exp`, so a caller outside the corpus can print a nested
operation and get text that fails with E0308.

A compiled module already has its answer: `fjs/edag/rust`'s `valueExpr`
prints every operation as `(…)?`, since `pub fn module` answers the
`Result` a throw lands in. So does a lazy position in either printer: a
lazy operand is a thunk whose body prints propagating, however deeply an
operation nests inside it, so a `?` there lands in the closure's own
`Result` — which is how the corpus's `unreached` operand, an operation,
prints in a bare `check` statement today. The corpus's eager positions
print through `expExpr`,
whose statements hand each `Result` to `check` bare, so their shape is
still to decide. Deciding it is part of this issue rather than a detail of
it, because it sets what every emitted statement looks like. `?` inside a
closure — the thunk's answer, generalized — an `and_then` chain, or a
harness helper that takes the operands already unwrapped are the obvious
candidates; whichever is chosen, the flat statements should keep their
present shape, since `generated.rs` staying byte-stable across a change
like this is what makes the change reviewable.

### Proposal

**The lazy operators** are covered: `&&`, `||`, `??` and `?:` have their
groups, and the `unreached` operand proves non-establishment through the
value — it lowers to an operation that throws when established, and the
case answers a value only because the operator left it alone — with no
throw node in the schema. The second proof, a thunk that panics as a set of
tests that must fail, is
[should-panic-per-vm](./should-panic-per-vm.md)'s.

**The transport.** When the interpreter lands, the printer grows a second
output beside the direct-operator statements it prints today: one that
*constructs* each derivable case's expression as an `Any` and hands it to the
interpreter. Authoring stays single-source; only the transport is generated.
Once the deferred `Any`/CBOR serialization exists, the same expressions can
ship as serialized data instead. Either way this is what keeps the interpreter
and the generated code in agreement — the point the roadmap's test-generation
item makes — and the JavaScript side's counterpart is replacing `amnesia`
with the EDAG interpreter
([interpret-edag](../../fsc/todo/interpret-edag.md)), which owes the same
identity-memoization contract the corpus already relies on. The proof's own
inline evaluator is already gone: `amnesia` takes the corpus's shared nodes
as `Context`'s `memo`, so what is left to migrate is the evaluator itself,
not a second one beside it.

### Tasks

- [ ] Decide and implement how a nested operation propagates its `Result` in
      the printed Rust, keeping the flat statements as they are.
- [x] Add a `rustName` and an `op2Rust` entry for each of `&&`, `||`, and
      `??`, spelling the `nanvm-lib` API as it is implemented.
- [x] Add `&&`, `||`, and `??` groups with their value results.
- [x] Add non-establishment cases: the `unreached` operand, no throw node
      needed.
- [ ] Replace `amnesia` with the `interpret-edag` interpreter when it lands,
      and register the corpus as its test suite.
- [ ] Extend the printer to construct each case's expression as an `Any` and
      hand it to the `nanvm-lib` interpreter (serialized `Any` once the
      roadmap's post-MVP serialization exists).
- [ ] Register the corpus as the shared conformance vectors of
      [edag-spec](../../../todo/edag-spec.md).
- [ ] `tsc`, `fjs test`, `npm run gen`, `cargo test`,
      `cargo clippy -- -D warnings`, and `cargo fmt -- --check`.

### Related

- [`../README.md`](../README.md) — "The operations come from EDAG": what the
  corpus already derives, validates, and shares.
- [`../../../todo/edag-spec.md`](../../../todo/edag-spec.md) — the shared
  conformance test vectors this completes.
- [`../../../nanvm-lib/todo/mvp-roadmap.md`](../../../nanvm-lib/todo/mvp-roadmap.md)
  — the interpreter and remaining-operators items this feeds.
- [`../../fsc/todo/interpret-edag.md`](../../fsc/todo/interpret-edag.md) — the
  FunctionalScript executor that replaces `amnesia` here.
- [`../../../todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
  — positional laziness.
- `comparisonCases` in [`../module.f.mjs`](../module.f.mjs) (shipped) — the
  four relational groups derived from one table, so an argument pair reaches
  all of them or none.
