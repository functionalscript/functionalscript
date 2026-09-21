## The lazy operators have no lazy `.rs` spelling

**Priority:** P2
**Status:** blocked
**Blocked by:** [Stage B](../../todo/stage-b-operators.md) making these
nodes reachable from source

### Problem

`nanvm-lib` has the four operations — `Any::logical_and`, `logical_or`,
`nullish_coalescing` and `conditional`, in `nanvm-lib/src/vm/any/` — and
`fjs/edag/rust`'s `op2Rust`/`op3Rust` spell them, so the operator corpus
checks each against a JavaScript engine. Every one takes its operands as
`Self`, by value: right for the corpus, whose operands are values before
the case is stated, and wrong for a compiled module, where `a && b`
establishes `b` only when `a` is truthy and `c ? t : e` establishes one
arm — Rust would evaluate both before the call, and `false && (1n / 0n)`
would throw where JavaScript answers `false`. The EDAG says which
operands are lazy ([`fjs/edag/module.f.mjs`](../../../edag/module.f.mjs),
`op2Id` and `op3Id`); the printed Rust has nowhere to say it.

Nothing tracked this: the roadmap's operator item is done, the operations
being what it asked for, and `?:` is its own item there, about the VM.
The baseline today: every eager operator prints in a module as `(…)?`,
through `fjs/edag/rust`'s `valueExpr`, against the decided failure
contract `pub fn module<A: IVm>() -> Result<Any<A>, Any<A>>`; the four
lazy ones are exactly what `fjs/fsc/rust`'s `lazyOperator` refuses —
`lazyOp2`, the binary three, and `lazyOp3`, the ternary, named as `op2Id`
and `op3Id` name the vocabularies — so a module holding one is refused
rather than miscompiled. Their entries sit in the same `op2Rust`/`op3Rust`
tables the eager ones do, and spelling them there as they are would be
exactly the eager miscompile above.

The chains are the other conditional forms: a `?.` region establishes the
rest of the chain only when its base is not nullish, and the optional-call
steps (`|?.()`) likewise
([`fjs/edag/README.md`](../../../edag/README.md), "Chains"). The printer
refuses every chain step today, having no `.rs` spelling for one, so they
are not miscompiled either; when chains get a spelling, a `?.` region's
continuation is a thunk exactly as a lazy operand is below.

### Proposal

A lazy operand is a thunk: the generated code passes `() => Any` in Rust's
own terms, and the operation decides whether to run it.

```rust
fn logical_and(self, rhs: impl FnOnce() -> Result<Any<A>, Any<A>>) -> Result<Any<A>, Any<A>>;
fn logical_or(self, rhs: impl FnOnce() -> Result<Any<A>, Any<A>>) -> Result<Any<A>, Any<A>>;
fn nullish_coalescing(self, rhs: impl FnOnce() -> Result<Any<A>, Any<A>>) -> Result<Any<A>, Any<A>>;
fn conditional(
    self,
    consequent: impl FnOnce() -> Result<Any<A>, Any<A>>,
    alternate: impl FnOnce() -> Result<Any<A>, Any<A>>,
) -> Result<Any<A>, Any<A>>;
```

`FnOnce`, since an operand is established at most once; `impl`, so it
monomorphizes to nothing; a `Result`, since establishing the operand may
throw. Three things follow, and nothing else changes:

- **The printed text** is `(Any::logical_and(a, || Ok(b)))?`, `b` being
  whatever `valueExpr` prints for the operand. That composes on its own: a
  `?` inside the closure propagates out of the closure's `Result`, and the
  outer `?` out of `module`. The shared printer wraps the lazy positions and
  nothing more; the two callers need no telling apart, since the corpus
  spells them the same way.
- **The corpus** gains what it waited on: a right operand written
  `|| Err(…)` proves the operand was not established, with no `throw` node
  needed for that half
  ([`corpus-as-conformance-vectors.md`](../../../nanvm/todo/corpus-as-conformance-vectors.md)).
- **Sharing is computed over eager reaches only.** The compiler hoists a
  shared node into a `let` binding, which establishes it eagerly; a node
  reached only from lazy positions must not be hoisted, or the module would
  establish what the program does not. Laziness is positional in the EDAG,
  so a node is shared, and hoisted, only by its eager reaches; one reached
  only lazily prints inside the closure that reaches it, and two closures
  reaching it each establish it, as JavaScript does. That is the
  eager-restricted `refsOf` [Stage B](../../todo/stage-b-operators.md)
  lists.

The `nanvm-lib` and printer halves need no parser: they are proven through
the corpus and through `toRust` directly, the way the refusal is today.
The compiler lifts the refusal when Stage B makes the nodes reachable.

### Tasks

- [ ] `nanvm-lib`: the four operations take each lazy operand as an
      `impl FnOnce() -> Result<Any<A>, Any<A>>`; a breaking change,
      declared.
- [ ] `fjs/edag/rust`: `op2Rust`/`op3Rust` print a lazy operand as
      `|| Ok(…)`; the corpus regenerates, and gains non-establishment cases
      with a throwing thunk.
- [ ] `fjs/fsc/rust`: sharing over eager reaches only, with the proof of a
      node reached only lazily; then lift `lazyOperator`'s refusal, and
      prove `false && (1n / 0n)` and a `?:` with a throwing unselected arm
      through `nanvm-harness` once the grammar produces them.
- [ ] `cargo test`, `cargo clippy --all-targets`, `cargo fmt -- --check`;
      `tsc`, `fjs test`, `npm run cov` at 100%; `npm run gen` with no
      drift.

### Related

- [`../module.f.mjs`](../module.f.mjs) — `lazyOperator`, the refusal this
  issue lifts; every eager operator already prints there as `(…)?`, through
  `fjs/edag/rust`'s `valueExpr`, against the failure contract `pub fn
  module<A: IVm>() -> Result<Any<A>, Any<A>>`.
- [Stage B operators](../../todo/stage-b-operators.md) — the front end that
  makes these nodes reachable.
- [`fjs/edag/rust/module.f.mjs`](../../../edag/rust/module.f.mjs) — the
  by-value spellings the corpus keeps.
