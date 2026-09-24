## hoist-printer-helpers. The printer's named helpers capture its state instead of taking it

**Priority:** P4
**Status:** open

### Problem

`printer` in [`module.f.mjs`](../module.f.mjs) is one closure over the
analysis of a root — `order`, `eager`, `thunks`, `temporaries`, `bound`,
the names — and every named helper inside it captures that state: `f`,
`node`, `bare`, `closure`, `thunk`, `lazyOperand`, `result`, `declaredBy`,
`printOrder`, `letLine`, `block`, `propertyExpr`, `isThunk`,
`isTemporary`, `isShared`, `valueNodes`, `nameOf`, `composed`. The
convention in [`fjs/AGENTS.md`](../../../AGENTS.md#hoist-helpers-to-module-scope)
treats "captures no local state" as a target: a helper meaningful enough to
carry a name lifts its captures into leading curried parameters and lives
at module scope, so its identity is context-free and content-addressable.
Each printer invocation makes a fresh family of these closures instead.

The shape predates the temporaries layout — `f`, `bare`, `thunk`,
`result`, `nested`, `composed`, `closure` and `propertyExpr` were nested
the same way when the printer had two modes and a `shared` list — and
the layout added to the family rather than restructuring it. The helpers
that capture nothing are hoisted: `atomic`, `isMember`, `isComma`,
`isOperation`, `last`, `braced`, `lines`, `lazyOperandsOf`, `held`.

### Proposal

One record for what an invocation knows — the mode, the bindings, and
the analysis — threaded as the leading parameter of every helper:

```ts
type Scope = {
    readonly nested: boolean
    readonly bound: readonly (readonly [Exp, string])[]
    readonly temporaries: readonly (readonly [Exp, number])[]
    readonly thunks: readonly Exp[]
    readonly eager: readonly Exp[]
    readonly root: Exp
    readonly nameOf: (n: Exp) => string
}
```

`f`, `node`, `bare` and the rest become `scope => e => …` at module
scope, mutually recursive through the record rather than through the
enclosing closure; `printer` computes the record and answers
`{ f: f(scope), block: block(scope) }`. The proofs in
[`proof.f.mjs`](../proof.f.mjs) pin every output, so the restructuring is
checked by them alone: no generated file changes.

### Tasks

- [ ] The `Scope` record in `types.ts` (or `private.ts`), every helper
      hoisted over it; `tsc`, `fjs test`, `npm run cov` at 100%.
- [ ] `npm run gen`; generated Rust unchanged.

### Related

- [`../module.f.mjs`](../module.f.mjs) — `printer`.
- [`../../../AGENTS.md`](../../../AGENTS.md#hoist-helpers-to-module-scope) —
  the convention.
- [`./let-bindings-owner.md`](./let-bindings-owner.md) — the other
  restructuring of the same printer's item layer.
