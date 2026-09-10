## replace-unary-plus-with-number. Add the real `Number(x)` coercion

**Priority:** P3
**Status:** open

> **Scope narrowed.** This issue originally proposed dropping `Any::unary_plus`
> and moving the corpus's `unaryPlus` group to `'Number'`, on the premise that
> the EDAG has no unary `+`. That premise is gone: the EDAG spells unary
> plus as `['+', x]` (`op12Id` in
> [`fjs/edag/module.f.mjs`](../../fjs/edag/module.f.mjs)), `Any::unary_plus`
> is its `nanvm-lib` implementation, and the corpus group is on the
> EDAG-backed path. What is left here is the coercion that still does not
> exist.

### Problem

`Number(x)` is FunctionalScript's one numeric-coercion form — the language does
not parse unary `+` (see
[`spec/todo/2340-operators.md`](../../spec/todo/2340-operators.md)) — and it
is already a canonical EDAG id (`op1Id` in
[`fjs/edag/module.f.mjs`](../../fjs/edag/module.f.mjs)), chosen specifically
because JS's own unary `+` throws on a `bigint` where `Number(x)` does not.

`nanvm-lib` implements the former and not the latter. `Any::unary_plus()`
(`nanvm-lib/src/vm/any/mod.rs:73`) is exactly JS unary plus:

```rust
pub fn unary_plus(self) -> Result<Any<A>, Any<A>> {
    self.to_number().map(ToAny::to_any)
}
```

`to_number()` dispatches to `NumberCoercion` (`nanvm-lib/src/vm/number_coercion.rs`),
whose doc comment says plainly **"It equals to `+self` in JavaScript"** — i.e. it
implements ECMAScript's abstract `ToNumber`, the unary-plus operator's own algorithm,
which errors on `BigInt`:

```rust
fn bigint(self, _: BigInt<A>) -> Self::Result {
    Err("TypeError: Cannot convert a BigInt value to a number".into())
}
```

That is the right behavior for `['+', x]` and for the arithmetic and comparison
operators, which legitimately reject `BigInt` mixing the same way JS does. It is
*not* what the JS global function `Number(x)` does. Per spec, `Number(x)` goes
through `ToNumeric` and, for a `BigInt`, converts it via `BigInt::toNumber` (a possibly
lossy double conversion) instead of throwing. **Nothing in `nanvm-lib` implements that
conversion today** — `NumberCoercion::bigint` unconditionally errors, and no other code
converts a `BigInt<A>` to `f64`. So the `Number` EDAG node has no `nanvm-lib`
counterpart, and the corpus has no `Number` group to prove one against.

### Proposal

- Add a distinct coercion entry point implementing the actual `Number(x)` algorithm:
  `ToNumeric` then, for a `BigInt`, `BigInt::toNumber` (lossy double conversion) instead of
  an error. This needs a real `BigInt<A> → f64` conversion that doesn't exist anywhere in
  `nanvm-lib/src/vm/bigint/` today.
- **Do not touch `NumberCoercion`/`to_number()` or `Any::unary_plus`.**
  `Any::unary_plus`'s own doc comment (`any/mod.rs:44-45`) already says `to_number` is
  used "for internals in places where ECMAScript's abstract function `ToNumber` is
  needed" — that's the correct algorithm for unary `+` and for the arithmetic and
  comparison operators. The two coercions differ only in their `BigInt` arm; keep both,
  under names that say which is which.
- In the corpus, add a `Group1` with `op: 'Number'` beside the existing unary-plus
  group rather than replacing it. `numberCoercionCases` in
  [`fjs/nanvm/module.f.mjs`](../../fjs/nanvm/module.f.mjs) already lists the shared
  argument space once for unary `-` and unary `+`; a `Number` group derives from the same
  list with one difference, its bigint case expecting the converted number rather than
  `throws`. The `function` case escapes either way: `functionValue` has no expression
  whichever id the group carries.
- `fjs/nanvm/proof.f.mjs` needs no `op1Js` entry for `'Number'` — only escaped cases
  reach that table, and amnesia already evaluates the node — unless the group's
  `functionValue` case makes one necessary, as it does for unary `-`.
- `fjs/nanvm/rust/module.f.mjs`'s `op1Rust` and `rustName` tables gain the new Rust
  method and its generated function name; `fjs/nanvm/rust/proof.f.mjs`'s pinned
  expected-output strings follow.
- Regenerate `nanvm-lib/tests/test/generated.rs` via `npm run gen` rather than
  hand-editing it. The new cases land with a `rust` reason until the coercion exists,
  which is what keeps this issue's Rust half and corpus half independently mergeable.

### Tasks

- [ ] Implement the real `Number(x)` coercion, including a `BigInt<A> → f64` conversion.
- [ ] `fjs/nanvm/module.f.mjs`: add a `Group1` with `op: 'Number'`; its bigint case
      expects a converted number, not `throws`.
- [ ] `fjs/nanvm/rust/module.f.mjs` and `fjs/nanvm/rust/proof.f.mjs`: the emitted Rust
      call, its function name, and the pinned expected snippets.
- [ ] `npm run gen` to regenerate `nanvm-lib/tests/test/generated.rs`.
- [ ] `nanvm-lib/README.md`: a `Number` row in the operator table.
- [ ] `tsc`, `fjs test`, `npm run gen` (no diff), `cargo test`,
      `cargo clippy -- -D warnings`, and `cargo fmt -- --check`.

### Related

- `op12Id` in [`fjs/edag/module.f.mjs`](../../fjs/edag/module.f.mjs) — unary
  `+` as an EDAG node and `Any::unary_plus` as its implementation; the
  decision that narrowed this issue.
- [`edag-stage1-discussion.md`](../../todo/edag-stage1-discussion.md) — the "Number"
  row of its Operations table: the coercion that accepts bigints.
- [`fjs/nanvm/README.md`](../../fjs/nanvm/README.md) — the corpus's canonical-id rule.
- `src/vm/numeric.rs` — adjacent `Numeric<A>` algebra, with the same
  `any/`-vs-`numeric.rs` split this touches.
- operator-test-operation-model and reuse-edag-operators (both retired; shipped as the
  canonical-id corpus in [`fjs/nanvm/`](../../fjs/nanvm/README.md)) — the `Op`-union
  redesign this predates.
