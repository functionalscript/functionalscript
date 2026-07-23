## todjs-object-fold-is-a-map. `ast`: the `toDjs` object branch folds where a `map` suffices

**Priority:** P4
**Status:** open

### Problem

In `fjs/djs/ast/module.f.ts` the two container branches of `toDjs` are
asymmetric. The array branch is declarative (`:63`):

```ts
case 'array': { return toArray(map(toDjs(state))(ast[1])) }
```

but the object branch (`:66-67`) threads a bespoke accumulator type through a
`fold`:

```ts
const e = fold(foldAstObjectOp)({ runState: state, entries: null})(entries(ast)).entries
return fromEntries(e)
```

driven by `FoldObjectState` (`:29-32`) and `foldAstObjectOp` (`:41-46`):

```ts
const foldAstObjectOp
    :(entry: [string, AstConst]) => (state: FoldObjectState) => FoldObjectState
    = entry => state => {
        const e = concat(state.entries)([[entry[0], (toDjs(state.runState)(entry[1]))]])
        return { ... state, entries: e }
    }
```

The accumulator's `runState` field is loop-invariant — `foldAstObjectOp`
never changes it — and no step reads the entries accumulated so far. The fold
is a `map` in disguise. Contrast `foldOp` (`:34-39`), which is a genuine
fold: its `consts` accumulates and `cref` (`:62`) reads it back. Forcing the
reader to check whether this fold's state actually evolves is exactly the
mental-diff cost AGENTS.md warns about.

### Proposal

Collapse the object branch to mirror the array branch, deleting
`FoldObjectState` and `foldAstObjectOp` (~11 lines):

```ts
const mapEntryValue = (state: RunState) =>
    ([k, v]: readonly [string, AstConst]): readonly [string, Unknown] =>
        [k, toDjs(state)(v)]

// object branch:
return fromEntries(map(mapEntryValue(state))(entries(ast)))
```

`mapEntryValue` captures nothing local (its `state` is a leading curried
parameter), so it hoists to module scope per the AGENTS.md hoisting rule.
Behavior is unchanged: the entries were produced in the same order with the
same `toDjs(state)` transformation; only the disguise is removed.

### Tasks

- [ ] Replace the object branch with the `map`; delete `FoldObjectState` and
      `foldAstObjectOp`; hoist `mapEntryValue`.
- [ ] `npx tsc` clean; `fjs t` passes (`fjs/djs/ast/proof.f.ts` and the djs
      suite).

### Related

- `fjs/djs/ast/module.f.ts:29-32`, `:41-46`, `:48-70` — the types and code
  involved.
- [197](./197.md) — the cross-function `Unknown`-walker factory; it lists
  `toDjs` as a caveat and defers its internals, so this intra-function
  cleanup is independent of it.
- [663](./663-json-djs-tree-type.md) — type-only; unaffected.
