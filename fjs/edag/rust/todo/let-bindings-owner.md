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
at literals. The binding mechanism takes an `Exp` and belongs here;
string-only item wrappers and headers belong in
[rust-item-helpers](../../../nanvm/todo/rust-item-helpers.md)'s EDAG-free
item module.

### Proposal

One export beside `expExpr`:

```ts
/** The `let` lines for `bindings` in order, each initializer printed against the bindings before it. */
export const letBindings: (bindings: readonly (readonly [Exp, string])[]) => (name: (i: number) => string)
    => Result<readonly string[], readonly unknown[]>
```

`nanvm/rust`'s block becomes `letBindings(used.map(binding))(i => snakeCase(used[i][0]))`
unwrapped, retaining its indentation and plain Rust spelling. This helper
prints the corpus's named bindings. `fjs/compiler/rust` keeps consuming
`scopeTagged`: the EDAG printer's `letLine` retains the `let` keyword and
initializer tags, its import-use metadata, thunk typing and operation `?`
handling. `scope` remains the plain wrapper that removes tags from
`scopeTagged`'s output. The compiler's temporaries do not pass through the
plain `letBindings` helper.

If retained after the formatting-policy decision
below, `skipFn(signature, lines)` — the `#[rustfmt::skip]` item wrapper —
lives in `fjs/media/rust/item`, and the printers import it.

**Open question:**
[generated-rust-module-rustfmt-skip](../../../../nanvm-lib/todo/generated-rust-module-rustfmt-skip.md)
proposes the opposite for the corpus printer: `fjs/nanvm/rust` stops emitting
`#[rustfmt::skip]` per function, and one `#[rustfmt::skip] mod generated;`
in `nanvm-lib/tests/test/main.rs` covers the generated file. If that lands,
`fjs/compiler/rust`'s module alone may not justify a `skipFn` helper.
Which policy the corpus follows is undecided. The retained helper's owner
is settled: it consumes strings and already-rendered lines, so it belongs
in [rust-item-helpers](../../../nanvm/todo/rust-item-helpers.md)'s item
module. That issue also moves `indent` there, below this printer, which
then imports it.

### Tasks

- [ ] `letBindings` in `fjs/edag/rust` with proofs; move `nanvm/rust`'s
      named bindings onto it. Import `indent` from the item module
      rust-item-helpers adds; both printers use that indentation.
- [ ] Preserve `scopeTagged`'s temporary-binding marks and existing
      `toRustMarked` proofs: `let` is a keyword, initializer strings,
      numbers and literal words keep their kinds, the marked text equals
      `toRust`'s plain text, and no words are left unmarked. Keep `scope`'s
      lines equal to the untagged `scopeTagged` lines and preserve the
      compiler demo's highlighting.
- [ ] If retained after the formatting-policy decision, implement and
      prove `skipFn` in `fjs/media/rust/item`; the printers using the
      per-function wrapper import it from there.
- [ ] `npm run gen`; `tsc`, `fjs test`; generated Rust unchanged.

### Related

- [`../../../types/ts/todo/66c-emit-literals-via-owner-modules.md`](../../../types/ts/todo/66c-emit-literals-via-owner-modules.md) —
  the same principle for literals; this is the item layer.
- [rust-item-helpers](../../../nanvm/todo/rust-item-helpers.md) — owns
  `indent` and the string-only `skipFn` wrapper if retained.
- [generated-rust-module-rustfmt-skip](../../../../nanvm-lib/todo/generated-rust-module-rustfmt-skip.md)
  — proposes the corpus stop emitting `#[rustfmt::skip]` per function, which
  `skipFn` would keep; see the open question above.
- [`../../todo/identity-shared-walks.md`](../../todo/identity-shared-walks.md) —
  the walk that decides *which* nodes get a `let`.
