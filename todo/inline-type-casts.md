# Audit: inline `/** @type {T} */ (v)` casts

**Priority:** P2
**Status:** open

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

This issue is the audit of every remaining site.

### Method

Every `/** @type {T} */ (…)` in `fjs/` was enumerated mechanically, then each
site was probed against a clean `npx tsc` baseline (TypeScript 7.0.2, the
repository `tsconfig.json`) in two variants:

1. **delete the cast** — if `tsc` still passes, the cast is redundant;
2. **`@type` → `@satisfies`** — if that passes, the expression really is
   assignable to `T`, so the cast only *pins* a type and never overrides one.
   The same check licenses the annotated-declaration form, which checks the
   initializer against `T` the same way.

Sites failing both are inspected by hand: the compiler error says what the cast
is actually hiding, which decides between `assert*` and "no replacement
available".

### Findings

Counts exclude 221 `/** @type {const} */` casts (out of scope) and the one
existing `@satisfies`.

| Verdict | Count | Meaning |
| --- | --- | --- |
| **remove** | 181 | The cast is redundant: `npx tsc` passes with it deleted. No replacement needed at all. |
| **`@satisfies`** | 21 | Expression is assignable to `T`; the cast pins a type rather than overriding one. Use `@satisfies`, or hoist to an annotated `const`. |
| **declare** | 6 | Same, and the cast is already the whole initializer of a `const`, so the annotated-declaration form is a direct rewrite. |
| **assert** | 72 | A runtime check can establish the claim: `assertNotNullish`, `assert(typeof …)`, `assert(x instanceof Array)`, or a literal-range `assert`. |
| **keep** | 77 | None of the three applies: `any` bridges, generic erasure, nominal branding, TS2589 depth limits, or a genuine type/API mismatch the cast is papering over. |
| **total** | **357** | |

So **208 of 357 (58%) need no cast and no replacement machinery at all** — 181
simply delete, 27 become a check instead of an override. Another 72 have a real
runtime check available. Only 77 are load-bearing.

Deleting the 181 is not quite one sweep: 172 of them come out together with
`npx tsc` still clean, but the 9 in `fjs/types/rtti/parse/module.f.mjs` and
`fjs/types/rtti/validate/module.f.mjs` are each redundant *individually* and
trip TS2589 ("instantiation excessively deep") when removed as a group. Those
two files need one cast at a time, keeping whichever removal the depth limit
still tolerates.

#### Sub-findings worth acting on first

- **`fjs/js/tokenizer/module.f.mjs`** — 37 of its 39 casts are redundant. The
  `_CreateToToken<…>` casts on the arrow literals passed to
  `rangeFunc(…)`/`rangeSetFunc(…)` are already contextually typed through
  `create(def)(…)`; deleting all of them keeps `npx tsc` green.
- **`Array.isArray` never narrows `readonly T[]` out of a union.** Eight `Dir`
  casts (`fjs/ci/proof.f.mjs`, `fjs/effects/node/proof.f.mjs`,
  `fjs/effects/node/virtual/module.f.mjs`) sit right after a guard that *looks*
  like it should have narrowed. Replacing `Array.isArray(x)` with
  `x instanceof Array` makes the existing `assert` / `if` narrow, and all eight
  casts delete — as does the ninth `Dir` cast in the same family, which is
  already redundant. Verified: `npx tsc` clean.
- **`unknown` in MCP proofs** — 40 of the 72 `assert` candidates are
  `fjs/protocol/mcp/proof.f.mjs`, `fjs/mcp/proof.f.mjs` and `fjs/cas/proof.f.mjs`
  reaching into a JSON-RPC response typed `unknown`. Each cast is an unchecked
  claim about a response shape the proof is supposed to be testing. A small set
  of `assert`-based accessors (`errorCode(resp)`, `resultOf(resp)`,
  `textOf(resp)`) — or rtti `validate` — would replace all of them and make the
  proofs actually assert what they claim.
- **Literal-range casts are assertable.** `fjs/asn.1/module.f.mjs:68`
  (`_ClassPc`) and `fjs/types/function/compare/module.f.mjs:12,17`
  (`Index<3>`, `Index<5>`) narrow an arithmetic result to a literal union;
  `assert(i === 0 || i === 1 || i === 2)` narrows identically and checks.
  Verified: `npx tsc` clean.

#### What genuinely has to stay

- `/** @type {any} */` bridges inside the rtti visitors
  (`fjs/types/rtti/{parse,validate,common,data}`) and `fjs/effects/module.f.mjs`
  — generic erasure with no runtime counterpart, several hitting TS2589.
- `asNominal` / `asBase` in `fjs/types/nominal/module.f.mjs` — branding
  `identity`, by construction unrepresentable.
- `fjs/bnf/descent/module.f.mjs:199` — documented TS7022 cycle cut.
- The `TS2322`/`TS2345`/`TS2352`/`TS2339` group: the cast is overriding a real
  mismatch (e.g. `do_('memRead')` typed as `<T>(key: Key<T>) => Effect<MemRead, T>`,
  `Unknown` vs `unknown` parameters in the MCP proofs, `Index`/tuple arity).
  These are the ones AGENTS.md means by "it usually means the types or the code
  structure should be improved instead" — each needs an API change, not a
  different cast syntax.

### Proposal

Land in this order, each step independently verifiable with `npx tsc` and `fjs t`:

1. Delete the 172 redundant casts outside the two rtti visitors; then take the
   remaining 9 one at a time.
2. Swap `Array.isArray` → `instanceof Array` at the eight `Dir` sites and delete
   those casts.
3. Convert the 21 + 6 checking casts to `@satisfies` / annotated declarations.
4. Introduce the `assert`-based accessors for the MCP/CAS proofs and convert the
   72 `assert` candidates.
5. For the remaining 77, open follow-up issues per type/API problem rather than
   rewriting the cast.

### Full table

Verdict per site. `Line` is the line of the opening `/**` in the current tree.

| File | Line | `@type {T}` | Verdict | Replacement / why not |
| --- | --- | --- | --- | --- |
| `fjs/asn.1/module.f.mjs` | 68 | `_ClassPc` | **assert** | `assert(v === … \|\| …)` narrows the literal range |
| `fjs/bnf/descent/module.f.mjs` | 199 | `_Task` | keep | breaks a control-flow inference cycle (TS7022) |
| `fjs/bnf/ll1/module.f.mjs` | 98 | `_DispatchRule` | **assert** | `assertNotNullish` / `assert(v !== undefined)` |
| `fjs/bnf/ll1/module.f.mjs` | 119 | `_DispatchRule` | **assert** | `assertNotNullish` / `assert(v !== undefined)` |
| `fjs/bnf/ll1/module.f.mjs` | 258 | `_DispatchRule` | **assert** | `assertNotNullish` / `assert(v !== undefined)` |
| `fjs/cas/evo/module.f.mjs` | 70 | `Cache` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/cas/evo/module.f.mjs` | 284 | `Result<readonly Revision[], string>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/cas/evo/module.f.mjs` | 454 | `List<never, Ok<Vec>>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/cas/evo/module.f.mjs` | 457 | `Effect<MemOp, Result<Hash, string>>` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/cas/evo/proof.f.mjs` | 46 | `IoResult<Vec>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/cas/evo/proof.f.mjs` | 60 | `IoResult<Vec>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/cas/evo/proof.f.mjs` | 61 | `IoResult<Vec>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/cas/evo/proof.f.mjs` | 76 | `List<never, Ok<Vec>>` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/cas/evo/proof.f.mjs` | 88 | `List<never, Ok<Vec>>` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/cas/evo/proof.f.mjs` | 96 | `List<never, Ok<Vec>>` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/cas/evo/proof.f.mjs` | 107 | `List<never, Ok<Vec>>` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/cas/evo/proof.f.mjs` | 123 | `List<never, Ok<Vec>>` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/cas/evo/proof.f.mjs` | 585 | `List<never, Ok<Vec>>` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/cas/evo/proof.f.mjs` | 609 | `List<never, Ok<Vec>>` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/cas/module.f.mjs` | 252 | `(result: IoResult<Vec>) => List<FileCasOperation, IoResult<V…` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/cas/module.f.mjs` | 274 | `readonly Vec[]` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/cas/module.f.mjs` | 309 | `(result: IoResult<Vec>) => List<ReadBytes, IoResult<Vec>>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/cas/module.f.mjs` | 348 | `(v: Vec) => Effect<Rm, IoResult<Vec>>` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/cas/proof.f.mjs` | 56 | `readonly unknown[]` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/cas/proof.f.mjs` | 91 | `Parameters<typeof match>[0]` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/cas/proof.f.mjs` | 108 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/cas/proof.f.mjs` | 246 | `List<FileCasOperation, IoResult<Vec>>` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/cas/proof.f.mjs` | 291 | `List<FileCasOperation, IoResult<Vec>>` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/cas/proof.f.mjs` | 310 | `List<FileCasOperation, IoResult<Vec>>` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/cas/proof.f.mjs` | 343 | `List<never, Ok<Vec>>` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/cas/proof.f.mjs` | 360 | `List<never, Ok<Vec>>` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/cas/proof.f.mjs` | 374 | `IoResult<Vec>` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/cas/proof.f.mjs` | 375 | `IoResult<Vec>` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/cas/proof.f.mjs` | 387 | `IoResult<Vec>` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/cas/proof.f.mjs` | 388 | `IoResult<Vec>` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/cas/proof.f.mjs` | 403 | `IoResult<Vec>` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/cas/proof.f.mjs` | 404 | `IoResult<Vec>` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/cas/proof.f.mjs` | 417 | `IoResult<Vec>` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/cas/proof.f.mjs` | 418 | `IoResult<Vec>` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/cas/proof.f.mjs` | 457 | `List<never, IoResult<Vec>>` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/ci/nix/module.f.mjs` | 94 | `(id: string) => string` | **declare** | hoist to `/** @type {(id: string) => string} */ const flakePath = …` |
| `fjs/ci/nix/module.f.mjs` | 100 | `(id: string, command: string) => string` | **declare** | hoist to `/** @type {(id: string, command: string) => string} */ const nixDevelop = …` |
| `fjs/ci/proof.f.mjs` | 43 | `Dir` | **assert** | guard uses `Array.isArray`, which never removes `readonly T[]` from a union — swap for `instanceof Array` and the existing check narrows |
| `fjs/crypto/sign/proof.f.mjs` | 65 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/djs/module.f.mjs` | 41 | `(result: Result<Unknown, ParseError>) => Effect<_CompileOp, …` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/djs/parser/module.f.mjs` | 511 | `AstModule` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/djs/proof.f.mjs` | 14 | `readonly Vec[]` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/djs/tokenizer/module.f.mjs` | 295 | `TokenMetadata` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/djs/tokenizer/module.f.mjs` | 304 | `ReadonlySet<string>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/djs/tokenizer/module.f.mjs` | 393 | `JsToken` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/djs/tokenizer/module.f.mjs` | 406 | `JsToken` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/djs/tokenizer/module.f.mjs` | 468 | `Unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/djs/tokenizer/module.f.mjs` | 470 | `DescentMatch<TokenMetadata>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/djs/tokenizer/module.f.mjs` | 485 | `Unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/djs/tokenizer/module.f.mjs` | 508 | `DescentMatch<TokenMetadata>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/djs/tokenizer/proof.f.mjs` | 889 | `Unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/djs/tokenizer/proof.f.mjs` | 893 | `Unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/djs/tokenizer/proof.f.mjs` | 897 | `Unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/djs/tokenizer/proof.f.mjs` | 901 | `Unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/djs/tokenizer/proof.f.mjs` | 909 | `Unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/djs/tokenizer/proof.f.mjs` | 913 | `Unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/djs/tokenizer/proof.f.mjs` | 918 | `Unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/djs/tokenizer/proof.f.mjs` | 924 | `Unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/djs/tokenizer/proof.f.mjs` | 928 | `Unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/djs/tokenizer/proof.f.mjs` | 933 | `Unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/djs/transpiler/module.f.mjs` | 103 | `(context: ParseContext) => Effect<ReadFile, Result<Unknown, …` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/effects/eff/proof.f.mjs` | 15 | `OperationMap<_AddOp, number>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/memory/module.f.mjs` | 34 | `<T>(value: T) => Effect<MemCreate, Key<T>>` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/effects/memory/module.f.mjs` | 39 | `<T>(key: Key<T>) => Effect<MemRead, T>` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/effects/memory/module.f.mjs` | 44 | `<T>(key: Key<T>, value: T) => Effect<MemWrite, void>` | **declare** | hoist to `/** @type {<T>(key: Key<T>, value: T) => Effect<MemWrite, void>} */ const write = …` |
| `fjs/effects/module.f.mjs` | 379 | `(...payload: readonly unknown[]) => R` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/module.f.mjs` | 380 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/effects/node/memory/module.mjs` | 60 | `ToAsyncOperationMap<MemOp>` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/effects/node/memory/proof.mjs` | 28 | `import('../../types.ts').ToAsyncOperationMap<MemOp>` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/effects/node/module.f.mjs` | 38 | `{ readonly code?: unknown }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/effects/node/module.f.mjs` | 47 | `<O extends Operation, T>(...a: readonly Effect<O, T>[]) => E…` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/effects/node/module.f.mjs` | 57 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/effects/node/module.f.mjs` | 176 | `Effect<O \| WriteBytes, IoResult<void>>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/node/module.f.mjs` | 186 | `<O extends Operation>(listener: RequestListener<O>) => Effec…` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/node/module.f.mjs` | 207 | `Func<Write>` | **declare** | hoist to `/** @type {Func<Write>} */ const write = …` |
| `fjs/effects/node/module.f.mjs` | 219 | `Console` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/node/module.f.mjs` | 222 | `Console` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/node/module.f.mjs` | 227 | `Func<Read>` | **declare** | hoist to `/** @type {Func<Read>} */ const read = …` |
| `fjs/effects/node/module.mjs` | 118 | `T` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/node/module.mjs` | 193 | `Uint8Array \| null` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/node/module.mjs` | 287 | `Erl<NodeOp>` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/effects/node/module.mjs` | 305 | `_Server` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/effects/node/proof.f.mjs` | 85 | `Dir` | **assert** | guard uses `Array.isArray`, which never removes `readonly T[]` from a union — swap for `instanceof Array` and the existing check narrows |
| `fjs/effects/node/proof.f.mjs` | 125 | `{ code?: unknown }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/effects/node/proof.f.mjs` | 276 | `Dir` | **assert** | guard uses `Array.isArray`, which never removes `readonly T[]` from a union — swap for `instanceof Array` and the existing check narrows |
| `fjs/effects/node/proof.f.mjs` | 316 | `never` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/node/proof.f.mjs` | 324 | `never` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/node/proof.f.mjs` | 354 | `readonly Vec[]` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/node/proof.f.mjs` | 364 | `Dir` | **assert** | guard uses `Array.isArray`, which never removes `readonly T[]` from a union — swap for `instanceof Array` and the existing check narrows |
| `fjs/effects/node/virtual/module.f.mjs` | 50 | `Dir` | **assert** | guard uses `Array.isArray`, which never removes `readonly T[]` from a union — swap for `instanceof Array` and the existing check narrows |
| `fjs/effects/node/virtual/module.f.mjs` | 152 | `Dir` | **assert** | guard uses `Array.isArray`, which never removes `readonly T[]` from a union — swap for `instanceof Array` and the existing check narrows |
| `fjs/effects/node/virtual/module.f.mjs` | 198 | `Dir` | **assert** | guard uses `Array.isArray`, which never removes `readonly T[]` from a union — swap for `instanceof Array` and the existing check narrows |
| `fjs/effects/node/virtual/module.f.mjs` | 225 | `Dir` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/node/virtual/module.f.mjs` | 238 | `Dir` | **assert** | guard uses `Array.isArray`, which never removes `readonly T[]` from a union — swap for `instanceof Array` and the existing check narrows |
| `fjs/effects/node/virtual/module.f.mjs` | 329 | `readonly Vec[]` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/node/virtual/module.f.mjs` | 345 | `readonly Vec[]` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/node/virtual/module.f.mjs` | 362 | `Key<unknown>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/node/virtual/module.f.mjs` | 407 | `SandboxResult<unknown>` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/effects/node/virtual/proof.f.mjs` | 47 | `JsModule` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/node/virtual/proof.f.mjs` | 113 | `JsModule` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/node/virtual/proof.f.mjs` | 119 | `JsModule` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/node/virtual/proof.f.mjs` | 223 | `JsModule` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/node/virtual/proof.f.mjs` | 351 | `JsModule` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/proof.f.mjs` | 32 | `OperationMap<_AddOp, number>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/proof.f.mjs` | 46 | `OperationMap<_AnyOp, number>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/proof.f.mjs` | 51 | `readonly number[]` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/proof.f.mjs` | 65 | `readonly number[]` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/proof.f.mjs` | 84 | `string` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/effects/proof.f.mjs` | 85 | `(value: number) => Effect<never, import('../types/result/typ…` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/emergent_testing/module.f.mjs` | 64 | `TestFn` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/emergent_testing/proof.f.mjs` | 169 | `() => unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/emergent_testing/proof.f.mjs` | 333 | `Parameters<typeof mockRun<_RegisterMockOps, _RegisterMockSta…` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/emergent_testing/proof.f.mjs` | 339 | `readonly [_RegisterMockState, readonly unknown[]]` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/emergent_testing/proof.f.mjs` | 341 | `readonly [_RegisterMockState, readonly unknown[]]` | keep | cast overrides the inferred type (TS2352) — needs a type/API change, not a check |
| `fjs/emergent_testing/proof.f.mjs` | 434 | `Parameters<typeof mockRun<_RegisterMockOps \| Readdir \| Impor…` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/emergent_testing/proof.f.mjs` | 441 | `readonly [undefined, readonly unknown[]]` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/emergent_testing/proof.f.mjs` | 443 | `readonly [undefined, readonly unknown[]]` | keep | cast overrides the inferred type (TS2352) — needs a type/API change, not a check |
| `fjs/emergent_testing/proof.f.mjs` | 448 | `Effect<_RegisterMockOps \| Readdir \| Import, number>` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/emergent_testing/proof.f.mjs` | 539 | `unknown[]` | **assert** | guard uses `Array.isArray`, which never removes `readonly T[]` from a union — swap for `instanceof Array` and the existing check narrows |
| `fjs/emergent_testing/proof.f.mjs` | 544 | `unknown[]` | **assert** | guard uses `Array.isArray`, which never removes `readonly T[]` from a union — swap for `instanceof Array` and the existing check narrows |
| `fjs/fsc/proof.f.mjs` | 21 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/js/tokenizer/module.f.mjs` | 262 | `JsToken` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/js/tokenizer/module.f.mjs` | 341 | `_CreateToToken<_TokenizerState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 343 | `_CreateToToken<_TokenizerState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 344 | `_CreateToToken<_TokenizerState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 345 | `_CreateToToken<_TokenizerState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 346 | `_CreateToToken<_TokenizerState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 347 | `_CreateToToken<_TokenizerState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 348 | `_CreateToToken<_TokenizerState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 349 | `_CreateToToken<_TokenizerState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 470 | `_CreateToToken<_InvalidNumberState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 472 | `_CreateToToken<_InvalidNumberState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 487 | `_CreateToToken<_ParseStringState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 489 | `_CreateToToken<_ParseStringState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 490 | `_CreateToToken<_ParseStringState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 491 | `_CreateToToken<_ParseStringState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 492 | `_CreateToToken<_ParseStringState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 503 | `_CreateToToken<_ParseEscapeCharState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 504 | `_CreateToToken<_ParseEscapeCharState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 505 | `_CreateToToken<_ParseEscapeCharState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 506 | `_CreateToToken<_ParseEscapeCharState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 507 | `_CreateToToken<_ParseEscapeCharState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 508 | `_CreateToToken<_ParseEscapeCharState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 509 | `_CreateToToken<_ParseEscapeCharState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 546 | `_CreateToToken<_ParseIdState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 566 | `_CreateToToken<_ParseCommentState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 568 | `_CreateToToken<_ParseCommentState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 573 | `_CreateToToken<_ParseCommentState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 575 | `_CreateToToken<_ParseCommentState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 576 | `_CreateToToken<_ParseCommentState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 581 | `_CreateToToken<_ParseCommentState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 583 | `_CreateToToken<_ParseCommentState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 584 | `_CreateToToken<_ParseCommentState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 585 | `_CreateToToken<_ParseCommentState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 600 | `_CreateToToken<_ParseWhitespaceState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 601 | `_CreateToToken<_ParseWhitespaceState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 612 | `_CreateToToken<_ParseNewLineState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 613 | `_CreateToToken<_ParseNewLineState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 618 | `_CreateToToken<_EofState>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/js/tokenizer/module.f.mjs` | 689 | `List<List<number \| null>>` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/mcp/cas/module.f.mjs` | 187 | `(args: Ts<typeof casAddArgs>) => Effect<FileCasOperation \| M…` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/cas/module.f.mjs` | 198 | `List<never, Ok<Vec>>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/cas/module.f.mjs` | 199 | `(writeResult: IoResult<Vec>) => Effect<MemOp, ToolsCallResult>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/cas/module.f.mjs` | 204 | `Vec` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/cas/module.f.mjs` | 215 | `(args: Ts<typeof casGetArgs>) => Effect<FileCasOperation, To…` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/cas/module.f.mjs` | 295 | `() => Effect<FileCasOperation, ToolsCallResult>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/evo/module.f.mjs` | 122 | `(args: Ts<typeof evoListArgs>) => Effect<MemOp, ToolsCallRes…` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/evo/module.f.mjs` | 132 | `(args: Ts<typeof evoHeadArgs>) => Effect<MemOp, ToolsCallRes…` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/evo/module.f.mjs` | 146 | `(args: Ts<typeof evoRevisionArgs>) => Effect<O \| MemOp, Tool…` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/evo/module.f.mjs` | 156 | `(input: Ts<typeof evoAddArgs>) => Effect<O \| MemOp, ToolsCal…` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/evo/proof.f.mjs` | 35 | `ToolEntry<O>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/evo/proof.f.mjs` | 42 | `{ text: string }` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/proof.f.mjs` | 67 | `Unknown` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/mcp/proof.f.mjs` | 102 | `List<never, IoResult<Vec>>` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/mcp/proof.f.mjs` | 146 | `McpSessionState` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/proof.f.mjs` | 159 | `{ readonly result: ToolsCallResult }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/mcp/proof.f.mjs` | 165 | `{ readonly text: string }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/mcp/proof.f.mjs` | 179 | `string` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/proof.f.mjs` | 183 | `string` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/proof.f.mjs` | 212 | `readonly unknown[]` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/proof.f.mjs` | 268 | `readonly unknown[]` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/proof.f.mjs` | 305 | `{ readonly error?: { readonly code: number }, readonly id: u…` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/mcp/proof.f.mjs` | 340 | `{ readonly error?: { readonly code: number }, readonly id: u…` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/mcp/proof.f.mjs` | 347 | `{ result: { tools: readonly { name: string }[] } }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/mcp/proof.f.mjs` | 350 | `{ result: { tools: readonly { inputSchema: { type?: string }…` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/mcp/proof.f.mjs` | 479 | `{ type: string }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/mcp/proof.f.mjs` | 494 | `{ type: string }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/mcp/proof.f.mjs` | 623 | `object` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/mcp/proof.f.mjs` | 624 | `object` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/mcp/proof.f.mjs` | 660 | `string` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/proof.f.mjs` | 678 | `string` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/mcp/proof.f.mjs` | 705 | `string` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/media/html/module.f.mjs` | 70 | `keyof typeof escapeTable` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/media/json/parser/module.f.mjs` | 67 | `_JsonObject<P>` | **assert** | `assertNotNullish` / `assert(v !== undefined)` |
| `fjs/media/json/parser/module.f.mjs` | 108 | `_JsonArray<P>` | **assert** | `assertNotNullish` / `assert(v !== undefined)` |
| `fjs/media/json/parser/module.f.mjs` | 128 | `_JsonObject<P>` | **assert** | `assertNotNullish` / `assert(v !== undefined)` |
| `fjs/media/json/proof.f.mjs` | 18 | `null` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/media/json/proof.f.mjs` | 18 | `unknown` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/media/json/proof.f.mjs` | 23 | `null` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/media/json/proof.f.mjs` | 23 | `unknown` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/media/json/schema/proof.f.mjs` | 14 | `JsonValue` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/media/json/schema/proof.f.mjs` | 14 | `unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/media/json/serializer/module.f.mjs` | 79 | `keyof typeof escapeTable` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/media/type/proof.f.mjs` | 27 | `List<never, Result<Vec, unknown>>` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/module.f.mjs` | 56 | `NodeProgram` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/nanvm/proof.f.mjs` | 59 | `readonly any[]` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/nanvm/proof.f.mjs` | 124 | `any` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/nanvm/proof.f.mjs` | 125 | `any` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/nanvm/proof.f.mjs` | 160 | `any` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/nanvm/rust/module.f.mjs` | 81 | `readonly Value[]` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/protocol/mcp/module.f.mjs` | 164 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/protocol/mcp/module.f.mjs` | 167 | `Ts<T>` | keep | "instantiation excessively deep" (TS2589) |
| `fjs/protocol/mcp/module.f.mjs` | 235 | `McpSessionState` | **declare** | hoist to `/** @type {McpSessionState} */ const uninitializedState = …` |
| `fjs/protocol/mcp/module.f.mjs` | 287 | `InitializedState` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/protocol/mcp/proof.f.mjs` | 62 | `Effect<_Op, ToolsListResult>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/protocol/mcp/proof.f.mjs` | 67 | `Effect<_Op, ToolsCallResult>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/protocol/mcp/proof.f.mjs` | 81 | `Effect<MemOp, any>` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/protocol/mcp/proof.f.mjs` | 81 | `unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/protocol/mcp/proof.f.mjs` | 96 | `McpSessionState` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/protocol/mcp/proof.f.mjs` | 97 | `Unknown` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/protocol/mcp/proof.f.mjs` | 103 | `McpSessionState` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/protocol/mcp/proof.f.mjs` | 105 | `Unknown` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/protocol/mcp/proof.f.mjs` | 106 | `Unknown` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/protocol/mcp/proof.f.mjs` | 114 | `McpSessionState` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/protocol/mcp/proof.f.mjs` | 116 | `Unknown` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/protocol/mcp/proof.f.mjs` | 117 | `Unknown` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/protocol/mcp/proof.f.mjs` | 118 | `Unknown` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/protocol/mcp/proof.f.mjs` | 150 | `object` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/protocol/mcp/proof.f.mjs` | 151 | `{ result: { protocolVersion: string } }` | keep | cast overrides the inferred type (TS2339) — needs a type/API change, not a check |
| `fjs/protocol/mcp/proof.f.mjs` | 159 | `{ error: { code: number } }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 177 | `{ error: { code: number } }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 184 | `object` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 191 | `object` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 197 | `object` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 203 | `object` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 209 | `{ error: { code: number } }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 230 | `{ error: { code: number } }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 237 | `{ error: { code: number } }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 243 | `{ error: { code: number }; id: unknown }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 244 | `{ error: { code: number }; id: unknown }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 252 | `{ result: ToolsListResult }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 253 | `{ result: ToolsListResult }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 260 | `{ result: ToolsListResult }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 267 | `{ error: { code: number } }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 274 | `{ text: string }` | keep | cast overrides the inferred type (TS2339) — needs a type/API change, not a check |
| `fjs/protocol/mcp/proof.f.mjs` | 274 | `{ result: ToolsCallResult }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 280 | `{ error: { code: number } }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 287 | `{ text: string }` | keep | cast overrides the inferred type (TS2339) — needs a type/API change, not a check |
| `fjs/protocol/mcp/proof.f.mjs` | 287 | `{ result: ToolsCallResult }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 294 | `{ error: { code: number } }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 300 | `{ error: { code: number } }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 307 | `{ error: { code: number } }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 313 | `{ error: { code: number } }` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/protocol/mcp/proof.f.mjs` | 327 | `(a: Ts<typeof echoArgs>) => Effect<never, ToolsCallResult>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/protocol/mcp/proof.f.mjs` | 332 | `{ readonly text: string }` | keep | cast overrides the inferred type (TS2339) — needs a type/API change, not a check |
| `fjs/protocol/mcp/stdio/proof.f.mjs` | 26 | `{ readonly id?: Id }` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/protocol/mcp/stdio/proof.f.mjs` | 54 | `Unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/protocol/mcp/stdio/proof.f.mjs` | 58 | `Unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/protocol/mcp/stdio/proof.f.mjs` | 62 | `Unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/protocol/mcp/stdio/proof.f.mjs` | 125 | `Response` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/protocol/mcp/stdio/proof.f.mjs` | 125 | `unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/sul/id/module.f.mjs` | 36 | `Point2D` | **assert** | `assertNotNullish` / `assert(v !== undefined)` |
| `fjs/sul/id/module.f.mjs` | 46 | `V8` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/sul/level/hash/module.f.mjs` | 52 | `Id` | **assert** | `assertNotNullish` / `assert(v !== undefined)` |
| `fjs/sul/level/hash/proof.f.mjs` | 83 | `_NodeList[number]` | **assert** | `assertNotNullish` / `assert(v !== undefined)` |
| `fjs/text/code_point/module.f.mjs` | 49 | `List<List<Unit\|null>>` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/text/sgr/module.f.mjs` | 52 | `string` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/text/sgr/module.f.mjs` | 54 | `string` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/text/sgr/module.f.mjs` | 56 | `string` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/text/sgr/module.f.mjs` | 58 | `string` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/bit_vec/proof.f.mjs` | 196 | `bigint` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/bit_vec/proof.f.mjs` | 198 | `bigint` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/btree/find/module.f.mjs` | 17 | `TNode<T>` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/types/btree/find/module.f.mjs` | 29 | `PathItem<T>` | keep | cast overrides the inferred type (TS2345) — needs a type/API change, not a check |
| `fjs/types/btree/find/module.f.mjs` | 33 | `First<T>` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/types/btree/remove/module.f.mjs` | 133 | `Path<T>` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/function/compare/module.f.mjs` | 12 | `Index<3>` | **assert** | `assert(v === … \|\| …)` narrows the literal range |
| `fjs/types/function/compare/module.f.mjs` | 17 | `Index<5>` | **assert** | `assert(v === … \|\| …)` narrows the literal range |
| `fjs/types/function/compare/module.f.mjs` | 22 | `any` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/types/function/compare/module.f.mjs` | 22 | `any` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/types/nominal/module.f.mjs` | 12 | `<N extends string, R extends string, B>(b: B) => Nominal<N, …` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/types/nominal/module.f.mjs` | 16 | `<T extends string, R extends string, B>(n: Nominal<T, R, B>)…` | keep | nominal branding of `identity` — no runtime representation |
| `fjs/types/nominal/proof.f.mjs` | 26 | `_IntersectionSafeId` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/nominal/proof.f.mjs` | 27 | `_IntersectionSafeId` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/nominal/proof.f.mjs` | 41 | `_SymbolKeyBranded` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/nominal/proof.f.mjs` | 42 | `_SymbolKeyBranded` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/nominal/proof.f.mjs` | 49 | `_SymbolIntersectionBranded` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/nominal/proof.f.mjs` | 49 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/types/nominal/proof.f.mjs` | 50 | `_SymbolIntersectionBranded` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/nominal/proof.f.mjs` | 50 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/types/range_map/module.f.mjs` | 114 | `RangeMapArray<T>` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/types/rtti/common/module.f.mjs` | 60 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/types/rtti/common/module.f.mjs` | 77 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/types/rtti/common/module.f.mjs` | 83 | `Struct` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/common/module.f.mjs` | 84 | `Primitive` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/common/module.f.mjs` | 176 | `Const` | **assert** | assert on the visitor tag before the branch |
| `fjs/types/rtti/common/module.f.mjs` | 182 | `Primitive0` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/common/proof.f.mjs` | 22 | `_Entries` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/common/proof.f.mjs` | 22 | `_Entries` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/common/proof.f.mjs` | 27 | `_Entries` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/common/proof.f.mjs` | 42 | `_Entries` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/common/proof.f.mjs` | 53 | `_Entries` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/common/proof.f.mjs` | 61 | `_Entries` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/data/module.f.mjs` | 750 | `Const` | **assert** | assert on the visitor tag before the branch |
| `fjs/types/rtti/module.f.mjs` | 27 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/types/rtti/module.f.mjs` | 69 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/types/rtti/parse/module.f.mjs` | 101 | `any` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/types/rtti/parse/module.f.mjs` | 103 | `(v: Unknown) => _ItemResult` | **remove** | redundant on its own, but removing it together with the other `remove` casts in this file trips TS2589 — remove one at a time |
| `fjs/types/rtti/parse/module.f.mjs` | 103 | `any` | **remove** | redundant on its own, but removing it together with the other `remove` casts in this file trips TS2589 — remove one at a time |
| `fjs/types/rtti/parse/module.f.mjs` | 105 | `any` | **`@satisfies`** | `@satisfies` (checks instead of overrides); or hoist to an annotated `const` |
| `fjs/types/rtti/parse/module.f.mjs` | 133 | `_ItemResult` | **remove** | redundant on its own, but removing it together with the other `remove` casts in this file trips TS2589 — remove one at a time |
| `fjs/types/rtti/parse/module.f.mjs` | 133 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/types/rtti/parse/module.f.mjs` | 137 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/types/rtti/parse/module.f.mjs` | 159 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/types/rtti/parse/module.f.mjs` | 159 | `(t: Type) => ValidateE` | **remove** | redundant on its own, but removing it together with the other `remove` casts in this file trips TS2589 — remove one at a time |
| `fjs/types/rtti/parse/module.f.mjs` | 159 | `any` | **remove** | redundant on its own, but removing it together with the other `remove` casts in this file trips TS2589 — remove one at a time |
| `fjs/types/rtti/parse/module.f.mjs` | 185 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/types/rtti/parse/module.f.mjs` | 198 | `any` | **remove** | redundant on its own, but removing it together with the other `remove` casts in this file trips TS2589 — remove one at a time |
| `fjs/types/rtti/parse/proof.f.mjs` | 30 | `T` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/types/rtti/parse/proof.f.mjs` | 37 | `ValidationError` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/types/rtti/parse/proof.f.mjs` | 112 | `number` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/parse/proof.f.mjs` | 114 | `number` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/parse/proof.f.mjs` | 121 | `number` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/parse/proof.f.mjs` | 122 | `number` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/parse/proof.f.mjs` | 125 | `number` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/parse/proof.f.mjs` | 126 | `number` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/parse/proof.f.mjs` | 133 | `number` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/parse/proof.f.mjs` | 137 | `number` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/parse/proof.f.mjs` | 199 | `unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/parse/proof.f.mjs` | 227 | `unknown` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/parse/proof.f.mjs` | 316 | `_A` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/types/rtti/parse/proof.f.mjs` | 316 | `unknown` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/types/rtti/proof.f.mjs` | 19 | `readonly unknown[]` | **assert** | `assertNotNullish` / `assert(v !== undefined)` |
| `fjs/types/rtti/validate/module.f.mjs` | 88 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/types/rtti/validate/module.f.mjs` | 114 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/types/rtti/validate/module.f.mjs` | 120 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/types/rtti/validate/module.f.mjs` | 140 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/types/rtti/validate/module.f.mjs` | 140 | `(t: Type) => ValidateE` | **remove** | redundant on its own, but removing it together with the other `remove` casts in this file trips TS2589 — remove one at a time |
| `fjs/types/rtti/validate/module.f.mjs` | 140 | `any` | **remove** | redundant on its own, but removing it together with the other `remove` casts in this file trips TS2589 — remove one at a time |
| `fjs/types/rtti/validate/module.f.mjs` | 158 | `any` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |
| `fjs/types/rtti/validate/module.f.mjs` | 171 | `any` | **remove** | redundant on its own, but removing it together with the other `remove` casts in this file trips TS2589 — remove one at a time |
| `fjs/types/rtti/validate/proof.f.mjs` | 23 | `ValidationError` | **assert** | value is `unknown` (JSON / IO): needs a real check — `assert(typeof …)`, `in`, or rtti `validate`/`parse` |
| `fjs/types/rtti/validate/proof.f.mjs` | 110 | `number` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/validate/proof.f.mjs` | 112 | `number` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/validate/proof.f.mjs` | 119 | `number` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/validate/proof.f.mjs` | 120 | `number` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/validate/proof.f.mjs` | 123 | `number` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/validate/proof.f.mjs` | 124 | `number` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/validate/proof.f.mjs` | 131 | `number` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/validate/proof.f.mjs` | 135 | `number` | **remove** | the cast is redundant — `npx tsc` passes with it deleted |
| `fjs/types/rtti/validate/proof.f.mjs` | 307 | `_A` | keep | cast overrides the inferred type (TS2322) — needs a type/API change, not a check |
| `fjs/types/rtti/validate/proof.f.mjs` | 307 | `unknown` | keep | `any` / `unknown` escape hatch — nothing to check at runtime |