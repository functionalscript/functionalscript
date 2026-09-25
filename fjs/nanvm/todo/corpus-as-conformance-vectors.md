## corpus-as-conformance-vectors. Run the corpus's EDAG expressions on both executors

**Priority:** P3
**Status:** open

### Problem

Every case in [`fjs/nanvm/`](../README.md) now denotes an EDAG expression:
`caseExp` in [`module.f.mjs`](../module.f.mjs) derives it, the proof
validates it against the [`fjs/edag`](../../edag/README.md) schema and
evaluates it, and [`rust/module.f.mjs`](../rust/module.f.mjs) prints it. That
makes the corpus the conformance examples (test vectors) shared by the FJS and
Rust implementations of that schema — in *authoring*. In
*execution* it is not yet: each side still runs the case through its own
operator, and no executor consumes the expression as a value.

One thing is missing, and it waits on work outside this directory.

**`nanvm-lib` never sees the expression.** The roadmap's interpreter executes
"the `Any` described by the EDAG spec"
([mvp-roadmap](../../../nanvm-lib/todo/mvp-roadmap.md)), and the derived case
expressions are exactly such values — but there is no transport. The roadmap
defers generic `Any` serialization to post-MVP, and this repository's
cross-language bridge is generated Rust, so until the interpreter exists there
is nothing to hand them to.

### A nested operation prints as a scope

Every `nanvm-lib` operator answers `Result<Any<A>, Any<A>>`, and `check`
consumes that `Result` at the top of a statement, which is why a flat case
is one expression: an operation nested in an eager position would hand the
outer one a `Result` where it takes an `Any`. Such a case — `['+',
unreached, 1]`, its left operand the operation `1n / 0n` — prints as a
scope instead, the shape a thunk's body and a compiled module already have:

```rust
check_throws::<A>("unreachedPlusOne", scope(|| {
    let c0: Any<A> = (bigint_any(1) / bigint_any(0))?;
    c0 + f64_any(0x3ff0000000000000)
}));
```

Its temporaries are bound inside the closure with their `?`, the root's
own `Result` is the closure's answer, and `check` receives it whole;
`scope` is the harness's, a name for the call rather than `(|| …)()`,
which clippy calls redundant. `caseText` in
[`../rust/module.f.mjs`](../rust/module.f.mjs) decides, by
`fjs/edag/rust`'s `nestsOperation`, and a flat case keeps its shape, so
`generated.rs` changed only where a case nests. `unreachedPlusOne` and
`unreachedCondition` are the corpus's own instances: an eager position
establishes its operand, and the throw is the case's.

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
item makes — and the JavaScript side's counterpart is running the corpus
through the EDAG interpreter as well, [`fjs/edag/memo`](../../edag/memo/module.f.mjs)
([interpret-edag](../../fsc/todo/interpret-edag.md)), which owes the same
identity-memoization contract the corpus already relies on. `amnesia` stays
the oracle ([`../../edag/amnesia/README.md`](../../edag/amnesia/README.md)),
so memo runs beside it rather than replacing it, the two answers pinned where
sharing decides them. The proof's own inline evaluator is already gone:
`amnesia` takes the corpus's shared nodes as `Context`'s `memo`.

### Tasks

- [x] Decide and implement how a nested operation propagates its `Result` in
      the printed Rust, keeping the flat statements as they are: a scope,
      `scope(|| { … })`.
- [x] Add a `rustName` and an `op2Rust` entry for each of `&&`, `||`, and
      `??`, spelling the `nanvm-lib` API as it is implemented.
- [x] Add `&&`, `||`, and `??` groups with their value results.
- [x] Add non-establishment cases: the `unreached` operand, no throw node
      needed.
- [ ] Run the corpus through `fjs/edag/memo` beside `amnesia`, pinning both
      answers where sharing decides them, and register the corpus as its test
      suite.
- [ ] Extend the printer to construct each case's expression as an `Any` and
      hand it to the `nanvm-lib` interpreter (serialized `Any` once the
      roadmap's post-MVP serialization exists).
- [ ] Register the corpus as the shared conformance vectors of the
      [`fjs/edag`](../../edag/README.md) schema, which
      [rust-schema-codegen](../../edag/todo/rust-schema-codegen.md) proves its
      generated Rust validation against.
- [ ] `tsc`, `fjs test`, `npm run gen`, `cargo test`,
      `cargo clippy -- -D warnings`, and `cargo fmt -- --check`.

### Related

- [`../README.md`](../README.md) — "The operations come from EDAG": what the
  corpus already derives, validates, and shares.
- [`../../edag/todo/rust-schema-codegen.md`](../../edag/todo/rust-schema-codegen.md)
  — the generated Rust side of the schema these vectors check.
- [`../../../nanvm-lib/todo/mvp-roadmap.md`](../../../nanvm-lib/todo/mvp-roadmap.md)
  — the interpreter and remaining-operators items this feeds.
- [`../../fsc/todo/interpret-edag.md`](../../fsc/todo/interpret-edag.md) — the
  FunctionalScript executor that replaces `amnesia` here.
- [`../../../todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
  — positional laziness.
- `comparisonCases` in [`../module.f.mjs`](../module.f.mjs) (shipped) — the
  four relational groups derived from one table, so an argument pair reaches
  all of them or none.
