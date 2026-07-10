## serializer-children-helper. `serializer`: name the container child-extraction once

**Priority:** P4
**Status:** open

### Problem

Two walkers in `fs/djs/serializer/module.f.ts` spell out the same
*"array → the values themselves / object → the values of its entries"*
child-extraction, each inside twin branches whose remaining bodies are
identical.

`countRefsOp` (`:149-175`) — the Array (`:163-167`) and Object (`:169-172`)
arms differ only in how children are produced:

```ts
if (djs instanceof Array) {
    if (refs.has(djs))
        return addRef(djs)(refs)
    return addRef(djs)(fold(countRefsOp)(refs)(djs))
}
if (refs.has(djs))
    return addRef(djs)(refs)
return addRef(djs)(fold(countRefsOp)(refs)(map(entryValue)(entries(djs))))
```

`getConstants`'s `op` (`:66-73`) repeats the same split:

```ts
if (djs instanceof Array) {
    return checkSelf(djs)(fold(op)(state)(djs))
}
return checkSelf(djs)(fold(op)(state)(map(entryValue)(entries(djs))))
```

This is the AGENTS.md rule *"when two code branches share most of their
structure, refactor so the shared part appears once and only the difference
lives in the conditional"* — and the difference itself (`children of a
container`) already has two real consumers, so extraction is past the
second-consumer bar. It is also the serializer counterpart of
[66e](./66e-parser-container-stack-bookkeeping.md), which merges the parser's container-kind branches.

### Proposal

One module-scope helper naming the difference:

```ts
/** The child values of a container, in traversal order. */
const children = (v: Object | Array): List<Unknown> =>
    v instanceof Array ? v : map(entryValue)(entries(v))
```

Then each walker's container arm collapses to a single non-branching body:

```ts
// countRefsOp, after the leaf cases:
return refs.has(djs)
    ? addRef(djs)(refs)
    : addRef(djs)(fold(countRefsOp)(refs)(children(djs)))

// getConstants.op default arm:
return checkSelf(djs)(fold(op)(state)(children(djs)))
```

No behavior change: the same child lists flow into the same folds.

### Tasks

- [ ] Add `children`; collapse the twin arms in `countRefsOp` and
      `getConstants`'s `op`.
- [ ] `npx tsc` clean; `fjs t` passes (`fs/djs/serializer/proof.f.ts`).

### Related

- `fs/djs/serializer/module.f.ts:66-73`, `:149-175`, `:80-82` (`entryValue`).
- [66e](./66e-parser-container-stack-bookkeeping.md) — the same container-kind merge on the parser side.
- [197](./197.md) — the eventual cross-function `Visitor` factory would
  supersede this, but it is deferred (blocked by [157](./157.md)); this
  two-line helper is independently landable now and shrinks what 197 will
  later absorb.
