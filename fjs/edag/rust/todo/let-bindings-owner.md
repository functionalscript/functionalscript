## let-bindings-owner. `nanvm/rust` spells the `let` line `edag/rust` claims to own

**Priority:** P4
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs)'s doc says the binding mechanism — "a
`let` per node, one line, one expression, each referenced by name where it
is used" — "lives here once rather than drifting between two copies". It
owns the temporaries a scope binds, `letLine` in `printer`, and imports
the `indent` both callers use from
[`fjs/media/rust/item`](../../../media/rust/item/module.f.js); the line
that spells a *caller's* binding —
the corpus's named shared value, whose initializer is printed against the
bindings before it — is still written by `fjs/nanvm/rust`:

```js
// fjs/nanvm/rust/module.f.mjs, groupFn
...used.map(([k, node], i) =>
    `${indent}let ${snakeCase(k)}: Any<A> = ${
        expExpr(used.slice(0, i).map(binding))(node)};`),
```

Both callers also emit `'#[rustfmt::skip]'` immediately before a
`fn …<A: IVm>` line and document at length why, and both open with the
`generatedHeader` of
[`fjs/media/rust/item`](../../../media/rust/item/module.f.js).
`fjs/media/rust` deliberately stops at literals. The binding mechanism
takes an `Exp` and belongs here; string-only item wrappers and headers
belong in that EDAG-free item module.

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
[generated-rust-module-rustfmt-skip](../../../../nanvm/lib/todo/generated-rust-module-rustfmt-skip.md)
proposes the opposite for the corpus printer: `fjs/nanvm/rust` stops emitting
`#[rustfmt::skip]` per function, and one `#[rustfmt::skip] mod generated;`
in `nanvm/lib/tests/test/main.rs` covers the generated file. If that lands,
`fjs/compiler/rust`'s module alone may not justify a `skipFn` helper.
Which policy the corpus follows is undecided. The retained helper's owner
is settled: it consumes strings and already-rendered lines, so it belongs
in the item module, `fjs/media/rust/item`, which already owns `indent`
below this printer.

### Tasks

- [ ] `letBindings` in `fjs/edag/rust` with proofs; move `nanvm/rust`'s
      named bindings onto it, keeping the item module's `indent`, which
      both printers use.
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

- [`fjs/js/string_escape`](../../../js/string_escape/module.f.mjs)'s
  `stringLiteral` — the same principle for string literals, done; this is
  the item layer.
- [`fjs/media/rust/item`](../../../media/rust/item/module.f.js) — owns
  `indent`, and the string-only `skipFn` wrapper if retained.
- [generated-rust-module-rustfmt-skip](../../../../nanvm/lib/todo/generated-rust-module-rustfmt-skip.md)
  — proposes the corpus stop emitting `#[rustfmt::skip]` per function, which
  `skipFn` would keep; see the open question above.
- [`../../todo/identity-shared-walks.md`](../../todo/identity-shared-walks.md) —
  the walk that decides *which* nodes get a `let`.
