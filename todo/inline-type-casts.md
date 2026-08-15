# Audit: inline `/** @type {T} */ (v)` casts

**Priority:** P2
**Status:** implemented — 283 of 357 removed or converted; 74 remain, each with a reason below

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

### What landed

357 casts at the start, excluding 221 `/** @type {const} */` (out of scope) and
one existing `@satisfies`. **74 remain.** Every step kept `npx tsc` and
`fjs t` (2797 tests) green.

| Step | Casts | What changed |
| --- | --: | --- |
| Delete the redundant ones | 182 | `tsc` passes with them gone. 172 in one sweep; the rtti visitors one at a time. `fjs/js/tokenizer` alone lost 37 — the `_CreateToToken` lambdas were already contextually typed through `create(def)(…)`. |
| `Array.isArray` → `instanceof Array` | 8 | `Array.isArray` narrows to `any[]`, which `readonly Vec[]` is not assignable to, so its negative branch never removes a `readonly` array from a union. Swapping the eight guards the `Dir` casts depended on made the surrounding `assert`/`if` narrow on their own. |
| `@satisfies` and annotated declarations | 23 | 6 at a `const` initializer became the declaration form; 17 became `@satisfies`. |
| Cast → runtime check | 17 | `assertNotNullish` for nullish lookups, `assert(top.kind === 'object')` for discriminated unions, literal-range asserts for `_ClassPc`/`Index<3>`/`Index<5>`, `typeof c !== 'function'` for the rtti `'const'` tag. |
| Checked accessors in proofs | 53 | `protocol/mcp/proof` 33 → 0, `mcp/proof` 11 → 1, `cas/proof` 8 → 0, plus five singles. A response is `unknown` and its shape is what the proof exists to check, so every one of those casts assumed the thing being proved. |
| **Total** | **283** | |

Two changes were not cast removals but are what made them possible: the local
`step1`/`step2`/`step3` helpers in `protocol/mcp/proof` declared `msg: unknown`
when every caller passes a JSON-RPC object literal, and `fjs run` now asserts a
module's `main` is callable before invoking it.

### What remains, and why

None of the 74 can be deleted or turned into a meaningful `@satisfies` — the
tree is at a fixed point under both probes. `@satisfies {any}` is excluded on
principle: it checks nothing, so an `any` cast is either load-bearing or it
should go.

| Reason | Count |
| --- | --: |
| `any` bridge — generic erasure, mostly the rtti visitors and `effects/module` | 24 |
| Cast overrides a genuine type mismatch (TS2322 / TS2345) | 36 |
| No overlap without `unknown` — a deliberately wrong value, or a nominal brand (TS2352) | 6 |
| Reads an `unknown` the surrounding code has established (TS18046) | 4 |
| One each: TS7022 cycle cut, TS2589 depth, nominal `identity`, `Function` → `NodeProgram` | 4 |

The 36 TS2322/TS2345 cases are the ones AGENTS.md means by "it usually means the
types or the code structure should be improved instead". They are deliberately
left rather than rewritten, and grouped by the API each papers over:

| Issue | Sites |
| --- | --: |
| [`fjs/effects/todo/do-generic-operation-signatures.md`](../fjs/effects/todo/do-generic-operation-signatures.md) | 3 |
| [`fjs/effects/todo/step-continuation-operation-union.md`](../fjs/effects/todo/step-continuation-operation-union.md) | 6 |
| [`fjs/effects/node/todo/async-operation-map-assignability.md`](../fjs/effects/node/todo/async-operation-map-assignability.md) | 2 (+2 nearby) |
| [`fjs/js/todo/token-kind-narrowing.md`](../fjs/js/todo/token-kind-narrowing.md) | 4 |
| [`fjs/types/btree/todo/find-path-item-typing.md`](../fjs/types/btree/todo/find-path-item-typing.md) | 3 |
| [`fjs/emergent_testing/todo/mockrun-parameters-inference.md`](../fjs/emergent_testing/todo/mockrun-parameters-inference.md) | 2 |

The rest are one-offs with no shared cause — a deliberately wrong value in a
negative test, a nominal brand, `Function` → `NodeProgram` — and are listed in
the table below rather than given an issue each.

### Follow-ups

- [strict-static-analysis.md](./strict-static-analysis.md) — `noUncheckedIndexedAccess`
  is now measurable against a tree with 283 fewer casts.
- [eslint.md](./eslint.md) — nothing stops these 74 from becoming 357 again;
  `no-unnecessary-type-assertion` would have found most of the first 182
  automatically, and the remaining 74 are the allowlist.
- [`spec/todo/3360-type-annotations.md`](../spec/todo/3360-type-annotations.md) —
  where the type layer is eventually going.

### Remaining sites

| File | Line | `@type {T}` | Why it stays |
| --- | --- | --- | --- |
| `fjs/bnf/descent/module.f.mjs` | 199 | `_Task` | breaks a control-flow inference cycle |
| `fjs/cas/evo/module.f.mjs` | 456 | `Effect<MemOp, Result<Hash, string>>` | cast overrides the inferred type — needs a type/API change, not a different cast |
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
| `fjs/effects/node/module.mjs` | 287 | `Erl<NodeOp>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/effects/node/module.mjs` | 305 | `_Server` | reads an `unknown` the surrounding code has already established |
| `fjs/effects/node/virtual/module.f.mjs` | 410 | `SandboxResult<unknown>` | cast overrides the inferred type — needs a type/API change, not a different cast |
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
| `fjs/mcp/proof.f.mjs` | 67 | `Unknown` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/mcp/proof.f.mjs` | 174 | `ToolsCallResult` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/media/json/proof.f.mjs` | 18 | `null` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/media/json/proof.f.mjs` | 18 | `unknown` | no overlap without going through `unknown` — a deliberately wrong value, or a nominal brand |
| `fjs/media/json/proof.f.mjs` | 23 | `null` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/media/json/proof.f.mjs` | 23 | `unknown` | no overlap without going through `unknown` — a deliberately wrong value, or a nominal brand |
| `fjs/module.f.mjs` | 63 | `NodeProgram` | narrows a checked `Function` to its declared signature — the one step `assert` cannot take |
| `fjs/nanvm/proof.f.mjs` | 59 | `readonly any[]` | reads an `unknown` the surrounding code has already established |
| `fjs/protocol/mcp/module.f.mjs` | 164 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/protocol/mcp/module.f.mjs` | 167 | `Ts<T>` | "instantiation excessively deep" |
| `fjs/protocol/mcp/proof.f.mjs` | 79 | `Effect<MemOp, any>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/protocol/mcp/stdio/proof.f.mjs` | 26 | `{ readonly id?: Id }` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/sul/id/module.f.mjs` | 46 | `V8` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/text/code_point/module.f.mjs` | 49 | `List<List<Unit\|null>>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/types/btree/find/module.f.mjs` | 17 | `TNode<T>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/types/btree/find/module.f.mjs` | 29 | `PathItem<T>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/types/btree/find/module.f.mjs` | 33 | `First<T>` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/types/function/compare/module.f.mjs` | 29 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/function/compare/module.f.mjs` | 29 | `any` | `any` bridge — generic erasure with no runtime counterpart; nothing for a check to check |
| `fjs/types/nominal/module.f.mjs` | 12 | `<N extends string, R extends string, B>(b: B) => Nominal<N…` | cast overrides the inferred type — needs a type/API change, not a different cast |
| `fjs/types/nominal/module.f.mjs` | 16 | `<T extends string, R extends string, B>(n: Nominal<T, R, B…` | nominal branding of `identity` — no runtime representation |
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