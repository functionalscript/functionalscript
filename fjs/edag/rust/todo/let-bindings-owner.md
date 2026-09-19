## let-bindings-owner. Two Rust printers spell the `let` line `edag/rust` claims to own

**Priority:** P4
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs)'s doc says the node-sharing mechanism —
"a `let` binding per shared node, cloned at each reference" — "lives here
once rather than drifting between two copies". Only `expExpr`'s lookup
lives here; the line that spells the binding, and the prefix slicing that
lets an initializer see the bindings before it, is written by both callers:

```js
// fjs/nanvm/rust/module.f.mjs, groupFn
...used.map(([k, node], i) =>
    `${indent}let ${snakeCase(k)}: Any<A> = ${expExpr(used.slice(0, i).map(binding))(node)};`),
// fjs/fsc/rust/module.f.mjs, letLines
return okThen(prev => mapOk(s => [...prev, `${indent}let c${i - 1}: Any<A> = ${s};`])(
    expExpr(bindings.slice(0, i - 1))(node)))(letLines(bindings)(i - 1))
```

Both files also declare `const indent = '    '`, both emit
`'#[rustfmt::skip]'` immediately before a `fn …<A: IVm>` line and document
at length why, and both join a `// @generated` header over the lines.
`fjs/media/rust` deliberately stops at literals, so the item layer's owner
is this module, and today it owns half of it.

### Proposal

One export beside `expExpr`:

```ts
/** The `let` lines for `bindings` in order, each initializer printed against the bindings before it. */
export const letBindings: (bindings: readonly (readonly [Exp, string])[]) => (name: (i: number) => string)
    => Result<readonly string[], readonly unknown[]>
```

`fsc/rust`'s `letLines` becomes `letBindings(bindings)(i => \`c${i}\`)`;
`nanvm/rust`'s block becomes `letBindings(used.map(binding))(i => snakeCase(used[i][0]))`
unwrapped. `indent` and a two-line `skipFn(signature, lines)` — the
`#[rustfmt::skip]` item wrapper — move beside it, so the invariant both
files document is stated once.

### Tasks

- [ ] `letBindings`, `indent`, `skipFn` in `fjs/edag/rust` with proofs;
      both printers rewritten over them.
- [ ] `npm run gen`; `tsc`, `fjs test`; generated Rust unchanged.

### Related

- [`../../../fsc/todo/66c-emit-literals-via-owner-modules.md`](../../../fsc/todo/66c-emit-literals-via-owner-modules.md) —
  the same principle for literals; this is the item layer.
- [`../../todo/identity-shared-walks.md`](../../todo/identity-shared-walks.md) —
  the walk that decides *which* nodes get a `let`.
