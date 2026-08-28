## replace-unary-plus-with-number. Drop `unary_plus`; add the real `Number(x)` coercion

**Priority:** P3
**Status:** open

### Problem

The EDAG design has settled on having **no unary `+` operator** in the language at all —
see [`edag-stage1-discussion.md`](../../todo/edag-stage1-discussion.md)'s "Operators"
table and [`reuse-edag-operators.md`](../../fjs/nanvm/todo/reuse-edag-operators.md)'s note
that "the EDAG has no unary `+`". `Number(x)` is the language's one numeric-coercion form,
chosen specifically because JS's own unary `+` throws on a `bigint` where `Number(x)` does
not.

`nanvm-lib` still ships `Any::unary_plus()`
(`nanvm-lib/src/vm/any/mod.rs:50`) as public API, and it is not dead in name only — it
implements the *wrong* algorithm for the role we actually want:

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

That is *not* what the JS global function `Number(x)` does. Per spec, `Number(x)` goes
through `ToNumeric` and, for a `BigInt`, converts it via `BigInt::toNumber` (a possibly
lossy double conversion) instead of throwing. **Nothing in `nanvm-lib` implements that
conversion today** — `NumberCoercion::bigint` unconditionally errors, and no other code
converts a `BigInt<A>` to `f64`. So this isn't a rename: the real `Number(x)` coercion
doesn't exist yet, and `unary_plus` is standing in for it under the wrong name and the
wrong bigint behavior.

`unary_plus` also isn't wired into any bytecode dispatcher or opcode match — a repo-wide
search (`rg -n "unary_plus" nanvm-lib/src`) turns up only its own definition, a comment in
`any/neg.rs` using it as a naming analogy, and `nanvm-lib/README.md`'s Unary operator
table row claiming `+` is a supported operator. It is exercised only by tests:
`nanvm-lib/tests/test/main.rs`'s `unary_plus_bigint_message` and the `unary_plus` group in
the generated `nanvm-lib/tests/test/generated.rs`.

The shared JS/TS operator-test corpus keeps the removed operator alive on the other side
too: `fjs/nanvm/types.ts`'s `Op` union has `'unaryPlus'`, `fjs/nanvm/module.f.mjs` declares
its case group (bigint case `expected: throws`), `fjs/nanvm/proof.f.mjs`'s `apply` switch
has `case 'unaryPlus': { return +a }`, and `fjs/nanvm/rust/module.f.mjs`'s `call` switch
emits `Any::unary_plus(...)` when generating `nanvm-lib/tests/test/generated.rs`.

### Proposal

- Remove `Any::unary_plus()` from `nanvm-lib/src/vm/any/mod.rs`, its README row
  (`nanvm-lib/README.md`'s Unary table), and the `any/neg.rs` comment that names it as a
  template for future operators.
- Add a distinct coercion entry point implementing the actual `Number(x)` algorithm:
  `ToNumeric` then, for a `BigInt`, `BigInt::toNumber` (lossy double conversion) instead of
  an error. This needs a real `BigInt<A> → f64` conversion that doesn't exist anywhere in
  `nanvm-lib/src/vm/bigint/` today.
- **Do not touch `NumberCoercion`/`to_number()`.** `Any::unary_plus`'s own doc comment
  (`any/mod.rs:44-45`) already says `to_number` is used "for internals in places where
  ECMAScript's abstract function `ToNumber` is needed" — that's the correct algorithm for
  arithmetic/comparison operators, which legitimately reject `BigInt` mixing the same way
  JS does. The two coercions differ only in their `BigInt` arm; keep both, under names
  that say which is which.
- In the corpus, the group's new spelling is the **canonical EDAG id `'Number'`**
  (`op1Id` in [`fjs/edag/module.f.mjs`](../../fjs/edag/module.f.mjs)) — never a new
  NaNVM-only name such as `numberCoercion`, which would introduce exactly the second
  vocabulary [`reuse-edag-operators.md`](../../fjs/nanvm/todo/reuse-edag-operators.md)
  exists to remove (that plan also renames `'stringCoercion'` to the canonical
  `'String'`). Order-aware: if that task has landed, move the group from its
  `NonEdagGroup` into an EDAG-backed `Group1` with `op: 'Number'` and delete the
  `NonEdagGroup` type; if this task lands first, replace `'unaryPlus'` with `'Number'`
  in the current `Op` union.
- Update `fjs/nanvm/module.f.mjs`'s case group for the renamed op: the bigint case's
  `expected` changes from `throws` to the converted number, not an error. Its
  `numberCoercionCases(negate)` helper is shared with `unaryMinus` — keep that helper and
  `unaryMinus`'s group untouched; only the `unaryPlus` group and its bigint case move.
- Update `fjs/nanvm/proof.f.mjs`'s dispatch: replace the `unaryPlus` arm (`return +a`)
  with a `'Number'` arm returning `Number(a)`.
- Update `fjs/nanvm/rust/module.f.mjs`'s `call` switch to emit the new Rust method instead
  of `Any::unary_plus(...)`, and `fjs/nanvm/rust/proof.f.mjs`'s pinned expected-output
  strings to match.
- Regenerate `nanvm-lib/tests/test/generated.rs` via `npm run ci-update` rather than
  hand-editing it.
- `nanvm-lib/tests/test/main.rs`'s `unary_plus_bigint_message` pins a throw message that no
  longer occurs under the new coercion — remove it (or, if some other input to the new
  coercion still throws, e.g. a `Symbol` if `Any` ever supports one, repoint the pinned
  test there instead).

### Tasks

- [ ] Remove `Any::unary_plus()`, its README row, and the `any/neg.rs` comment reference.
- [ ] Implement the real `Number(x)` coercion, including a `BigInt<A> → f64` conversion.
- [ ] `fjs/nanvm/types.ts`: retire `'unaryPlus'` in favor of the canonical `'Number'`
      (post-`reuse-edag-operators`: delete `NonEdagGroup`; before it: replace the
      member in `Op`).
- [ ] `fjs/nanvm/module.f.mjs`: move the group under `'Number'`; bigint case expects
      a converted number, not `throws`.
- [ ] `fjs/nanvm/proof.f.mjs`: dispatch `'Number'` to `Number(a)`.
- [ ] `fjs/nanvm/rust/module.f.mjs` and `fjs/nanvm/rust/proof.f.mjs`: update the emitted
      Rust call and its pinned expected snippets.
- [ ] `npm run ci-update` to regenerate `nanvm-lib/tests/test/generated.rs`.
- [ ] `nanvm-lib/tests/test/main.rs`: remove or repoint `unary_plus_bigint_message`.
- [ ] `npx tsc`, `fjs test`, `npm run ci-update` (no diff), `cargo test`,
      `cargo clippy -- -D warnings`, and `cargo fmt -- --check`.
- [ ] Changelog: `nanvm-lib` drops the public `unary_plus` method (BREAKING CHANGES).

### Related

- [`edag-stage1-discussion.md`](../../todo/edag-stage1-discussion.md) — the Operators
  table this decision comes from: no unary `+`, `Number` is the one coercion node.
- [`reuse-edag-operators.md`](../../fjs/nanvm/todo/reuse-edag-operators.md) — already notes
  `unaryPlus` has no EDAG operation to derive its shape from.
- [`numeric-operator-home.md`](./numeric-operator-home.md) — adjacent `Numeric<A>` algebra
  layout, same `any/`-vs-`numeric.rs` split this touches.
- operator-test-operation-model (retired; folded into
  [`reuse-edag-operators.md`](../../fjs/nanvm/todo/reuse-edag-operators.md)) — the
  `Op`-union redesign this predates.
