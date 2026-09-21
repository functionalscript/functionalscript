## The lazy operators have no lazy `.rs` spelling

**Priority:** P2
**Status:** open

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

That refusal is the generator policing itself for a mistake the Rust
compiler should catch, and it exists only because the operations' types
let the eager spelling through. The guard belongs in the signature: once
a lazy operand is a thunk, the eager spelling does not compile, and a
generator that prints it is simply wrong — so the refusal goes with the
signatures, not with Stage B.

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
- **Sharing stays as it is.** The compiler hoists a shared node into a
  `let` binding before the root, which establishes it eagerly — and that
  is right, thunks or not: an implicitly shared node is a `const`
  referenced twice, and JavaScript establishes a `const` at its
  declaration whatever the operators around its uses do. A `const` reached
  only through lazy operands is the lowering's business, not this
  printer's: [Stage B](../../todo/stage-b-operators.md)'s eager-restricted
  `refsOf` anchors it through the comma root so it is established as the
  source establishes it, and keeps `sharing` counting every reach.

The two halves need no parser: they are proven through the corpus and
through `toRust` directly. Non-establishment has two proofs. A thunk
written `|| Err(…)` proves it through the value, in the generic corpus as
it is. A thunk that panics proves it harder, as a set of tests that must
fail. The thunk calls a `vm::unstable` helper that panics — say
`|| not_established()` — since generated code spells no macro, `panic!`
included. The corpus cannot generate such a set today: a `#[should_panic]`
test is a concrete `#[test]`, and the corpus is generic over `IVm`, called
once per VM; that takes a redesign, one generated set per VM, and it has
no todo yet.

### Tasks

- [ ] `nanvm-lib`: the four operations take each lazy operand as an
      `impl FnOnce() -> Result<Any<A>, Any<A>>`; a breaking change,
      declared.
- [ ] `fjs/edag/rust`: `op2Rust`/`op3Rust` print a lazy operand as
      `|| Ok(…)`, in both printers; the corpus regenerates, and gains
      non-establishment cases with a `|| Err(…)` thunk.
- [ ] `fjs/fsc/rust`: delete `lazyOperator`, `lazyOp2` and `lazyOp3` —
      nothing is left to refuse — and prove `false && (1n / 0n)` and a
      `?:` with a throwing unselected arm through `toRust`, and through
      `nanvm-harness` once the grammar produces them.
- [ ] File the todo for the should-fail set: the corpus generated once per
      VM instead of once over `IVm`, so a thunk calling a panicking
      `vm::unstable` helper can be a `#[should_panic]` test of its own —
      generated code spells no macro.
- [ ] `cargo test`, `cargo clippy --all-targets`, `cargo fmt -- --check`;
      `tsc`, `fjs test`, `npm run cov` at 100%; `npm run gen` with no
      drift.

### Related

- [`../module.f.mjs`](../module.f.mjs) — `lazyOperator`, the refusal this
  issue deletes; every eager operator already prints there as `(…)?`, through
  `fjs/edag/rust`'s `valueExpr`, against the failure contract `pub fn
  module<A: IVm>() -> Result<Any<A>, Any<A>>`.
- [Stage B operators](../../todo/stage-b-operators.md) — the front end that
  makes these nodes reachable from source, and the anchoring of a `const`
  reached only lazily.
- [`fjs/edag/rust/module.f.mjs`](../../../edag/rust/module.f.mjs) — the
  by-value spellings the corpus keeps.
