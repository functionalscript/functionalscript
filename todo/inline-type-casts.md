# Audit: inline `/** @type {T} */ (v)` casts

**Priority:** P2
**Status:** implemented — 273 of 357 removed or converted; 84 remain, each with a reason below

### Problem

[AGENTS.md](../fjs/AGENTS.md) ("Avoid `as` type assertions") says an inline
`/** @type {T} */ (expr)` cast is the JSDoc equivalent of `as` and carries the
same hazard: it overrides whatever the compiler inferred and is erased at
runtime. It asks for one of three things instead — an annotated declaration
(`/** @type {T} */ const o = v`), `/** @satisfies {T} */ (v)` when the goal is
to *check* rather than *override*, or `assert` / `assertNotNullish` from
[`fjs/asserts/module.f.mjs`](../fjs/asserts/module.f.mjs) when the claim is an
invariant a runtime check can verify.

`@type {const}` is explicitly excluded: it must stay an inline cast.

This issue was the audit of every site, and then the cleanup.

### Method

Every `/** @type {T} */ (…)` in `fjs/` was enumerated mechanically, then each
site was probed against a clean `npx tsc` baseline (TypeScript 7.0.2, the
repository `tsconfig.json`) in two variants: with the cast deleted, and with
`@type` rewritten to `@satisfies`. Sites failing both were inspected by hand —
the compiler error says what the cast is hiding, which decides between `assert*`
and "no replacement available".

The tree was re-measured after each landed step, because removing one cast can
make another redundant, and because casts in the rtti visitors compete for the
same instantiation-depth budget.

**`tsc --noEmit` passing is not sufficient**, and review caught it doing the
wrong thing twice (below). Two further checks are required before a removal is
safe:

1. **Compare the emitted declarations.** `tsc --noEmit false
   --emitDeclarationOnly --declarationDir <dir>` before and after; a removal
   that changes an exported declaration's *type* is a published-API change no
   amount of `--noEmit` will surface.
2. **Watch `--noUnusedLocals`.** A removal that orphans a `@typedef` or an
   `@import` entry has taken the last reference to a type — which is a signal
   worth reading, not just tidying.

### What landed

357 casts at the start, excluding 221 `/** @type {const} */` (out of scope) and
one existing `@satisfies`. **84 of them remain.** Every step kept `npx tsc` and
`fjs t` green.

| Step | Casts | What changed |
| --- | --: | --- |
| Delete the redundant ones | 182 | `tsc` passes with them gone. 172 in one sweep; the rtti visitors one at a time. `fjs/js/tokenizer` alone lost 37 — the `_CreateToToken` lambdas were already contextually typed through `create(def)(…)`. |
| `Array.isArray` → `instanceof Array` | 8 | `Array.isArray` narrows to `any[]`, which `readonly Vec[]` is not assignable to, so its negative branch never removes a `readonly` array from a union. Swapping the eight guards the `Dir` casts depended on made the surrounding `assert`/`if` narrow on their own. |
| `@satisfies` and annotated declarations | 23 | 6 at a `const` initializer became the declaration form; 17 became `@satisfies`. |
| Cast → runtime check | 17 | `assertNotNullish` for nullish lookups, `assert(top.kind === 'object')` for discriminated unions, literal-range asserts for `_ClassPc`/`Index<3>`/`Index<5>`, `typeof c !== 'function'` for the rtti `'const'` tag. |
| Checked accessors in proofs | 53 | `protocol/mcp/proof` 33 → 0, `mcp/proof` 11 → 1, `cas/proof` 8 → 0, plus five singles. A response is `unknown` and its shape is what the proof exists to check, so every one of those casts assumed the thing being proved. |
| Reverted in review | −10 | see below |
| **Total** | **273** | |

Two changes were not cast removals but are what made them possible: the local
`step1`/`step2`/`step3` helpers in `protocol/mcp/proof` declared `msg: unknown`
when every caller passes a JSON-RPC object literal, and `fjs run` now asserts a
module's `main` is callable before invoking it.

### Corrections found in review

Ten removals were wrong, and `npx tsc` was green for every one of them.

**Four changed the published API.** Diffing the emitted `.d.mts` against `main`
found:

| Export | Was | Became |
| --- | --- | --- |
| `effects/node` `createServer` | `<O extends Operation>(listener: RequestListener<O>) => Effect<O \| CreateServer, Server>` | `(...payload: never) => Effect<Operation, never>` |
| `effects/node` `log`, `error` | `Console` | `(s: string) => Effect<Write, void>` |
| `cas/evo` `emptyCache` | `Cache` | `{ bySubject: {} }` |
| `types/range_map` (merge result) | `RangeMapArray<T>` | `[T, number][]` — **`readonly` lost** |

The `range_map` one is the sharpest: a purely functional library published a
mutable array type. `createServer`'s replacement is barely callable. Three are
now annotated declarations; `createServer` must stay an inline cast, because
`Func<O>` has nowhere to put a type parameter.

**Six deleted the assertion itself.** `types/nominal/proof.f.mjs` demonstrates,
per branding strategy, whether `<` compiles between two branded values. The
casts *are* the demonstration — they give the values the brand — and a brand is
unconstructible by design, so the declaration form rejects what the inline cast
accepted. Removing them left `const a = {}` comparing against `const b = {}`,
which proves nothing about the brand. `noUnusedLocals` reported the orphaned
`_IntersectionSafeId` typedef, which is how it was caught.

The lesson generalises: **in a proof about types, the annotation is the test**,
and a checker that only asks "does this still compile" cannot see it being
deleted.

### What remains, and why

84 of the 95 sites in the table below are from the audited set; the other 11
arrived on `main` after the audit (`mcp/cas/proof`, `types/patricia_trie`) and
are untouched here — new code bringing new casts is the argument for
[eslint.md](./eslint.md), not for widening this PR.

Of the 84, none can be deleted or turned into a meaningful `@satisfies` without
one of the two failures above. `@satisfies {any}` is excluded on
principle: it checks nothing, so an `any` cast is either load-bearing or it
should go.

| Reason | Count |
| --- | --: |
| Cast overrides a genuine type mismatch (TS2322 / TS2345) | 37 |
| `any` bridge — generic erasure, mostly the rtti visitors and `effects/module` | 24 |
| Unconstructible brand — the cast is the demonstration (6 restored, 2 never removed) | 8 |
| No overlap without `unknown` — a deliberately wrong value (TS2352) | 6 |
| Reads an `unknown` the surrounding code has established (TS18046) | 4 |
| Compiles without it, but the emitted `.d.mts` changes | 2 |
| One each: TS7022 cycle cut, TS2589 depth, nominal `identity` | 3 |
| Arrived on `main` after the audit | 11 |
| **Total** | **95** |

The 37 TS2322/TS2345 cases are the ones AGENTS.md means by "it usually means the
types or the code structure should be improved instead". Each needs its own
issue against the API it is papering over — `do_('memRead')` typed as
`<T>(key: Key<T>) => Effect<MemRead, T>`, `ToAsyncOperationMap<MemOp>` at the
node runners, `Index`/tuple arity in `types/btree` — not a different cast
syntax. They are deliberately left rather than rewritten.

### Follow-ups

- [strict-static-analysis.md](./strict-static-analysis.md) — its proposed
  declaration-emit check is no longer hypothetical: it is what caught the four
  API regressions above, and it belongs in CI.
- [eslint.md](./eslint.md) — nothing stops these from becoming 357 again, and
  11 new ones already arrived from `main` mid-cleanup.
  `no-unnecessary-type-assertion` would have found most of the first 182
  automatically — though, on the evidence above, it would also have proposed the
  ten that were wrong, so the allowlist matters as much as the rule.
- [`spec/todo/3360-type-annotations.md`](../spec/todo/3360-type-annotations.md) —
  where the type layer is eventually going.

### Remaining sites

| File | Line | `@type {T}` | Why it stays |
| --- | --- | --- | --- |
| `fjs/bnf/descent/module.f.mjs` | 199 | `_Task` | breaks a control-flow inference cycle |
| `fjs/cas/evo/module.f.mjs` | 466 | `Effect<MemOp, Result<Hash, string>>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/cas/module.f.mjs` | 348 | `(v: Vec) => Effect<Rm, IoResult<Vec>>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/crypto/sign/proof.f.mjs` | 65 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/djs/module.f.mjs` | 41 | `(result: Result<Unknown, ParseError>) => Effect<_CompileOp…` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/djs/tokenizer/module.f.mjs` | 295 | `TokenMetadata` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/djs/tokenizer/module.f.mjs` | 393 | `JsToken` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/djs/tokenizer/module.f.mjs` | 406 | `JsToken` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/djs/transpiler/module.f.mjs` | 103 | `(context: ParseContext) => Effect<ReadFile, Result<Unknown…` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/effects/memory/module.f.mjs` | 34 | `<T>(value: T) => Effect<MemCreate, Key<T>>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/effects/memory/module.f.mjs` | 39 | `<T>(key: Key<T>) => Effect<MemRead, T>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/effects/node/memory/module.mjs` | 60 | `ToAsyncOperationMap<MemOp>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/effects/node/memory/proof.mjs` | 28 | `import('../../types.ts').ToAsyncOperationMap<MemOp>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/effects/node/module.f.mjs` | 47 | `<O extends Operation, T>(...a: readonly Effect<O, T>[]) =>…` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/effects/node/module.f.mjs` | 57 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/effects/node/module.f.mjs` | 186 | `<O extends Operation>(listener: RequestListener<O>) => Eff…` | `tsc --noEmit` passes without it, but the emitted `.d.mts` changes — see "Corrections found in review" |
| `fjs/effects/node/module.mjs` | 287 | `Erl<NodeOp>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/effects/node/module.mjs` | 305 | `_Server` | reads an `unknown` the surrounding code has already established |
| `fjs/effects/node/virtual/module.f.mjs` | 409 | `SandboxResult<unknown>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/effects/proof.f.mjs` | 85 | `(value: number) => Effect<never, import('../types/result/t…` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/emergent_testing/module.f.mjs` | 64 | `TestFn` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/emergent_testing/proof.f.mjs` | 333 | `Parameters<typeof mockRun<_RegisterMockOps, _RegisterMockS…` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/emergent_testing/proof.f.mjs` | 341 | `readonly [_RegisterMockState, readonly unknown[]]` | no overlap without going through `unknown` — a deliberately wrong value, or a nominal brand |
| `fjs/emergent_testing/proof.f.mjs` | 434 | `Parameters<typeof mockRun<_RegisterMockOps \| Readdir \| Imp…` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/emergent_testing/proof.f.mjs` | 443 | `readonly [undefined, readonly unknown[]]` | no overlap without going through `unknown` — a deliberately wrong value, or a nominal brand |
| `fjs/emergent_testing/proof.f.mjs` | 448 | `Effect<_RegisterMockOps \| Readdir \| Import, number>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/fsc/proof.f.mjs` | 21 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/js/tokenizer/module.f.mjs` | 262 | `JsToken` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/js/tokenizer/module.f.mjs` | 689 | `List<List<number \| null>>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/mcp/cas/proof.f.mjs` | 33 | `readonly unknown[]` | arrived on `main` after the audit — not measured here |
| `fjs/mcp/cas/proof.f.mjs` | 38 | `unknown` | arrived on `main` after the audit — not measured here |
| `fjs/mcp/cas/proof.f.mjs` | 65 | `Parameters<typeof match>[0]` | arrived on `main` after the audit — not measured here |
| `fjs/mcp/cas/proof.f.mjs` | 85 | `any` | arrived on `main` after the audit — not measured here |
| `fjs/mcp/cas/proof.f.mjs` | 93 | `Key<Cache>` | arrived on `main` after the audit — not measured here |
| `fjs/mcp/cas/proof.f.mjs` | 93 | `any` | arrived on `main` after the audit — not measured here |
| `fjs/mcp/cas/proof.f.mjs` | 101 | `NonNullable<typeof entry>` | arrived on `main` after the audit — not measured here |
| `fjs/mcp/cas/proof.f.mjs` | 121 | `ToolsCallResult` | arrived on `main` after the audit — not measured here |
| `fjs/mcp/cas/proof.f.mjs` | 132 | `ToolsCallResult` | arrived on `main` after the audit — not measured here |
| `fjs/mcp/cas/proof.f.mjs` | 149 | `ToolsCallResult` | arrived on `main` after the audit — not measured here |
| `fjs/mcp/proof.f.mjs` | 67 | `Unknown` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/mcp/proof.f.mjs` | 174 | `ToolsCallResult` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/media/json/proof.f.mjs` | 18 | `null` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/media/json/proof.f.mjs` | 18 | `unknown` | no overlap without going through `unknown` — a deliberately wrong value, or a nominal brand |
| `fjs/media/json/proof.f.mjs` | 23 | `null` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/media/json/proof.f.mjs` | 23 | `unknown` | no overlap without going through `unknown` — a deliberately wrong value, or a nominal brand |
| `fjs/module.f.mjs` | 63 | `NodeProgram` | `tsc --noEmit` passes without it, but the emitted `.d.mts` changes — see "Corrections found in review" |
| `fjs/nanvm/proof.f.mjs` | 59 | `readonly any[]` | reads an `unknown` the surrounding code has already established |
| `fjs/protocol/mcp/module.f.mjs` | 171 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/protocol/mcp/module.f.mjs` | 174 | `Ts<T>` | "instantiation excessively deep" |
| `fjs/protocol/mcp/proof.f.mjs` | 81 | `Effect<MemOp, any>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/protocol/mcp/stdio/proof.f.mjs` | 26 | `{ readonly id?: Id }` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/sul/id/module.f.mjs` | 45 | `V8` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/text/code_point/module.f.mjs` | 49 | `List<List<Unit\|null>>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/types/btree/find/module.f.mjs` | 17 | `TNode<T>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/types/btree/find/module.f.mjs` | 29 | `PathItem<T>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/types/btree/find/module.f.mjs` | 33 | `First<T>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/types/function/compare/module.f.mjs` | 29 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/function/compare/module.f.mjs` | 29 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/nominal/module.f.mjs` | 12 | `<N extends string, R extends string, B>(b: B) => Nominal<N…` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/types/nominal/module.f.mjs` | 16 | `<T extends string, R extends string, B>(n: Nominal<T, R, B…` | nominal branding of `identity` — no runtime representation |
| `fjs/types/nominal/proof.f.mjs` | 26 | `_IntersectionSafeId` | the brand is unconstructible by design, so only an override can produce a value of this type; the cast **is** the demonstration |
| `fjs/types/nominal/proof.f.mjs` | 27 | `_IntersectionSafeId` | the brand is unconstructible by design, so only an override can produce a value of this type; the cast **is** the demonstration |
| `fjs/types/nominal/proof.f.mjs` | 41 | `_SymbolKeyBranded` | the brand is unconstructible by design, so only an override can produce a value of this type; the cast **is** the demonstration |
| `fjs/types/nominal/proof.f.mjs` | 42 | `_SymbolKeyBranded` | the brand is unconstructible by design, so only an override can produce a value of this type; the cast **is** the demonstration |
| `fjs/types/nominal/proof.f.mjs` | 49 | `_SymbolIntersectionBranded` | the brand is unconstructible by design, so only an override can produce a value of this type; the cast **is** the demonstration |
| `fjs/types/nominal/proof.f.mjs` | 49 | `any` | the brand is unconstructible by design, so only an override can produce a value of this type; the cast **is** the demonstration |
| `fjs/types/nominal/proof.f.mjs` | 50 | `_SymbolIntersectionBranded` | the brand is unconstructible by design, so only an override can produce a value of this type; the cast **is** the demonstration |
| `fjs/types/nominal/proof.f.mjs` | 50 | `any` | the brand is unconstructible by design, so only an override can produce a value of this type; the cast **is** the demonstration |
| `fjs/types/patricia_trie/module.f.mjs` | 49 | `readonly [typeof lastHash, typeof storage]` | arrived on `main` after the audit — not measured here |
| `fjs/types/range_map/module.f.mjs` | 114 | `RangeMapArray<T>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/types/rtti/common/module.f.mjs` | 61 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/common/module.f.mjs` | 78 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/module.f.mjs` | 27 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/module.f.mjs` | 69 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/parse/module.f.mjs` | 101 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/parse/module.f.mjs` | 103 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/parse/module.f.mjs` | 105 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/parse/module.f.mjs` | 133 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/parse/module.f.mjs` | 137 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/parse/module.f.mjs` | 159 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/parse/module.f.mjs` | 159 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/parse/module.f.mjs` | 185 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/parse/proof.f.mjs` | 30 | `T` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/types/rtti/parse/proof.f.mjs` | 37 | `ValidationError` | reads an `unknown` the surrounding code has already established |
| `fjs/types/rtti/parse/proof.f.mjs` | 316 | `_A` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/types/rtti/parse/proof.f.mjs` | 316 | `unknown` | no overlap without going through `unknown` — a deliberately wrong value, or a nominal brand |
| `fjs/types/rtti/validate/module.f.mjs` | 88 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/validate/module.f.mjs` | 114 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/validate/module.f.mjs` | 120 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/validate/module.f.mjs` | 140 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/validate/module.f.mjs` | 140 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/validate/module.f.mjs` | 158 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/rtti/validate/proof.f.mjs` | 23 | `ValidationError` | reads an `unknown` the surrounding code has already established |
| `fjs/types/rtti/validate/proof.f.mjs` | 307 | `_A` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/types/rtti/validate/proof.f.mjs` | 307 | `unknown` | no overlap without going through `unknown` — a deliberately wrong value, or a nominal brand |