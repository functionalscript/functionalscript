## let-bindings-owner. Two Rust printers spell the `let` line `edag/rust` claims to own

**Priority:** P4
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs)'s doc says the binding mechanism — "a
`let` per node, one line, one expression, each referenced by name where it
is used" — "lives here once rather than drifting between two copies". It
owns the temporaries a scope binds, `letLine` in `printer`, and the
`indent` both callers import; the line that spells a *caller's* binding —
the corpus's named shared value, whose initializer is printed against the
bindings before it — is still written by `fjs/nanvm/rust`:

```js
// fjs/nanvm/rust/module.f.mjs, groupFn
...used.map(([k, node], i) =>
    `${indent}let ${snakeCase(k)}: Any<A> = ${
        expExpr(used.slice(0, i).map(binding))(node)};`),
```

Both callers also emit `'#[rustfmt::skip]'` immediately before a
`fn …<A: IVm>` line and document at length why, and both join a
`// @generated` header over the lines. `fjs/media/rust` deliberately stops
at literals, so the item layer's owner is this module, and today it owns
part of it.

### Proposal

One export beside `expExpr`:

```ts
/** The `let` lines for `bindings` in order, each initializer printed against the bindings before it. */
export const letBindings: (bindings: readonly (readonly [Exp, string])[]) => (name: (i: number) => string)
    => Result<readonly string[], readonly unknown[]>
```

`nanvm/rust`'s block becomes `letBindings(used.map(binding))(i => snakeCase(used[i][0]))`
unwrapped, and `scope`'s temporaries could print through the same export
with `i => \`c${i}\``. A two-line `skipFn(signature, lines)` — the
`#[rustfmt::skip]` item wrapper — moves beside it, so the invariant both
files document is stated once.

**Open question:**
[generated-rust-module-rustfmt-skip](../../../../nanvm-lib/todo/generated-rust-module-rustfmt-skip.md)
proposes the opposite for the corpus printer: `fjs/nanvm/rust` stops emitting
`#[rustfmt::skip]` per function, and one `#[rustfmt::skip] mod generated;`
in `nanvm-lib/tests/test/main.rs` covers the generated file. If that lands,
`skipFn` has one caller, `fjs/fsc/rust`'s module, and may not earn its place.
Which of the two the corpus follows is undecided.

### Tasks

- [ ] `letBindings`, `indent`, `skipFn` in `fjs/edag/rust` with proofs;
      both printers rewritten over them.
- [ ] `npm run gen`; `tsc`, `fjs test`; generated Rust unchanged.

### Related

- [`../../../types/ts/todo/66c-emit-literals-via-owner-modules.md`](../../../types/ts/todo/66c-emit-literals-via-owner-modules.md) —
  the same principle for literals; this is the item layer.
- [generated-rust-module-rustfmt-skip](../../../../nanvm-lib/todo/generated-rust-module-rustfmt-skip.md)
  — proposes the corpus stop emitting `#[rustfmt::skip]` per function, which
  `skipFn` would keep; see the open question above.
- [`../../todo/identity-shared-walks.md`](../../todo/identity-shared-walks.md) —
  the walk that decides *which* nodes get a `let`.
