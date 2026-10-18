## Unify Rust binding emission through FAST

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
`fjs/media/rust` deliberately stops at literals. The current binding printer
takes an `Exp` and lives in `edag/rust`; string-only item wrappers and headers
belong in the EDAG-free item module.

### Proposal

The [compiler modularization proposal](../../../todo/compiler-vocabulary-and-modularization.md)
sets the MVP path for every target: EDAG → FAST → target serialization.
Common EDAG-to-FAST conversion owns sharing, bindings and evaluation regions;
any further expression-to-binding normalization belongs in common FAST
processing used by all targets. The Rust serializer renders those bindings
with Rust syntax and runtime-operation spelling.

This supersedes the earlier proposal to add an EDAG-aware `letBindings`
helper while retaining `scopeTagged` as the compiler's separate binding path.
The migration must retire the replaced paths, rather than extend them.
Preserving Rust-only temporary decisions or unchanged generated Rust text is
not a compatibility requirement; preserve semantics and update output
expectations to the common FAST policy.

Move both compiler temporaries and corpus named bindings onto this path.
The corpus supplies named shared values even when a value is reached only
once. Carry these supplied bindings through the common conversion, preserving
source identity and dependencies before dependents. Render binding syntax
once in the FAST-to-Rust serializer.

The useful contracts of the current marked output survive the migration:
keyword and initializer token kinds, import-use metadata, thunk typing,
operation `?` handling, and equality of demarked and plain output.
These do not require retaining the `scopeTagged` API or its graph traversal.

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

- [ ] During the common FAST migration, carry the corpus's supplied named
      bindings through the common conversion and render their declarations
      through the same FAST-to-Rust serializer as compiler temporaries.
      Retire the replaced EDAG-aware emission paths.
- [ ] Adapt the existing `toRustMarked` proofs to the new serializer: `let`
      remains a keyword, initializer literals keep their token kinds, no
      words are left unmarked, and demarked output equals plain output.
      Preserve import-use metadata, thunk typing, operation `?` handling
      and the compiler demo's highlighting without retaining a separate
      temporary-placement algorithm.
- [ ] If retained after the formatting-policy decision, implement and
      prove `skipFn` in `fjs/media/rust/item`; the printers using the
      per-function wrapper import it from there.
- [ ] Regenerate Rust and update output expectations to the common FAST
      policy. Prove preserved sharing, supplied bindings, dependency order and
      eager/lazy semantics; run the checks required by the implementation diff.

### Related

- [`fjs/js/string_escape`](../../../js/string_escape/module.f.mjs)'s
  `stringLiteral` — the same principle for string literals, done; this is
  the item layer.
- [`fjs/media/rust/item`](../../../media/rust/item/module.f.js) — owns
  `indent`, and the string-only `skipFn` wrapper if retained.
- [generated-rust-module-rustfmt-skip](../../../../nanvm/lib/todo/generated-rust-module-rustfmt-skip.md)
  — proposes the corpus stop emitting `#[rustfmt::skip]` per function, which
  `skipFn` would keep; see the open question above.
- [Compiler vocabulary and modularization](../../../todo/compiler-vocabulary-and-modularization.md)
  — the common FAST path and binding ownership that govern this migration.
- [`../../todo/identity-shared-walks.md`](../../todo/identity-shared-walks.md) —
  existing shared traversal and its planned ownership.
