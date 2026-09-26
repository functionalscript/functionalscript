## corpus-as-conformance-vectors. Run the corpus's EDAG expressions on both executors

**Priority:** P3
**Status:** open

### Problem

Every case in [`fjs/nanvm/`](../README.md) now denotes an EDAG expression:
`caseExp` in [`module.f.mjs`](../module.f.mjs) derives it, the proof
validates it against the [`fjs/edag`](../../edag/README.md) schema and runs it
through `amnesia` with the corpus's shared nodes supplied as memoized values.
[`rust/module.f.mjs`](../rust/module.f.mjs) prints direct operator calls.
Authoring is shared, but the corpus still needs to exercise `fjs/edag/memo`
and compare direct Rust execution with interpretation of the same EDAG as data.

The [roadmap](../../../nanvm-lib/todo/mvp-roadmap.md) supplies that native path
by AOT-compiling the FJS interpreter and its runner to Rust. It does not add
an interpreter to `nanvm-lib`. The native conformance run depends on the
[immutable-cache rewrite](../../edag/memo/todo/immutable-cache.md), public
interpreter integration and compiler coverage of the required FJS dependency
closure. Host-side corpus integration can proceed independently.

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
`fjs/edag/rust`'s `nestsOperation`, and a flat case keeps its shape in the
generated `gen.corpus/` files. `unreachedPlusOne` and
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

**The transport.** Keep the direct-operator output. Add generated Rust that
*constructs* each derivable case's EDAG as `Any` data and passes it to the
AOT-compiled FJS conformance runner, using the FJS interpreter's
[public entry](../../fsc/todo/interpret-edag.md). This is a data handoff to
compiled FJS, not a new `nanvm-lib` interpreter or Rust EDAG representation.
Authoring stays single-source; only the transport is generated. The same
expressions may later travel through `Any`/CBOR serialization, but that is
not a prerequisite.

On JavaScript hosts, run the corpus through
[`fjs/edag/memo`](../../edag/memo/module.f.mjs) as well. Its observable results,
including sharing and throws, must agree with direct Rust and with the same
FJS interpreter compiled to Rust. `amnesia` stays
the oracle ([`../../edag/amnesia/README.md`](../../edag/amnesia/README.md)),
so memo runs beside it rather than replacing it, the two answers pinned where
sharing decides them. The proof's own inline evaluator is already gone:
`amnesia` takes the corpus's shared nodes as `Context`'s `memo`.

The optional [Rust EDAG library](../../../todo/rust-edag.md) and its
[schema-generated validation](../../edag/todo/rust-schema-codegen.md) can reuse
these vectors if that work resumes. Neither is required for this conformance
plan or native self-hosting.

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
      hand it to the AOT-compiled FJS conformance runner after the immutable-cache,
      public-entry and compiler-coverage prerequisites are complete; compare
      the interpreted results with the existing direct Rust cases.
- [ ] Register the corpus as the shared conformance vectors of the
      [`fjs/edag`](../../edag/README.md) schema. If the optional Rust EDAG work
      resumes, reuse them for its generated validation and executor rather
      than making either a prerequisite for these tests.
- [ ] `tsc`, `fjs test`, `npm run gen`, `cargo test`,
      `cargo clippy -- -D warnings`, and `cargo fmt -- --check`.

### Related

- [`../README.md`](../README.md) — "The operations come from EDAG": what the
  corpus already derives, validates, and shares.
- [`../../edag/todo/rust-schema-codegen.md`](../../edag/todo/rust-schema-codegen.md)
  — deferred optional Rust validation that may reuse these vectors.
- [`../../../nanvm-lib/todo/mvp-roadmap.md`](../../../nanvm-lib/todo/mvp-roadmap.md)
  — direct Rust AOT and native execution through the compiled FJS interpreter.
- [`../../fsc/todo/interpret-edag.md`](../../fsc/todo/interpret-edag.md) — the
  FunctionalScript executor run beside the `amnesia` oracle here.
- [`../../../todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
  — positional laziness.
- `comparisonCases` in [`../module.f.mjs`](../module.f.mjs) (shipped) — the
  four relational groups derived from one table, so an argument pair reaches
  all of them or none.
