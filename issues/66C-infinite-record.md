# 66C-infinite-record. Use `?` for Infinite-Key Mapped Types

**Priority:** P2
**Status:** open

## Problem

TypeScript's mapped type `{ readonly[K in string]: T }` claims every string key is present
with a value of type `T`. That is false at runtime: accessing a key that was never set
returns `undefined`, not `T`. TypeScript accepts the lie silently, and callers get no
warning that the value might be absent.

```ts
type X = { readonly[K in string]: bigint }

const x: X = {}               // TypeScript accepts the empty object

const i = x['hello']          // inferred as `bigint`, actual runtime value is `undefined`
```

For **finite** key sets, the type is accurate — TypeScript enforces that every key is
initialised:

```ts
type _X1 = { readonly[K in 'hello']: bigint }

const _x1: _X1 = { 'hello': 1n }     // all keys must be present — correct

const i1 = _x1['hello']              // inferred as `bigint`, correct at runtime
```

For **infinite** key sets (`string`, `number`, or any unbounded union), use the optional
modifier `?` so that key access correctly widens to `T | undefined`:

```ts
type _X2 = { readonly[K in string]?: bigint }

const _x2: _X2 = {}                  // accepted

const i2 = _x2['hello']              // inferred as `bigint | undefined` — accurate
```

When all **defined** values are needed, iterate with `definedValues` (already in
`fs/types/object/module.f.ts`) or a forthcoming `definedEntries` helper.

## Recommendation

**Never** write `{ [k in T]: X }` when `T` is an infinite set (e.g. `string`).
**Always** write `{ [k in T]?: X }` instead.

## Proposal

### 1 — Helper types in `fs/types/object/module.f.ts`

Add two named aliases that make the finite/infinite distinction explicit:

```ts
/**
 * A read-only record with a finite key set `K`.
 * Every key is required to be present — `K` must be a string-literal union, not `string`.
 * Passing `string` as `K` produces `never` to prevent the silent runtime lie
 * where TypeScript types every access as `V` but the value is actually `undefined`.
 */
export type FiniteRecord<K extends string, V> =
    string extends K ? never : { readonly[P in K]: V }

/**
 * A read-only record with an infinite key set (all strings).
 * Keys are optional (`?`) because TypeScript cannot enforce that every string is set.
 */
export type InfiniteRecord<V> = { readonly[k in string]?: V }
```

The existing `ReadonlyRecord<S, T>` is `FiniteRecord<S, T>` when `S` is a literal union,
but allows `string` as `S` today, producing the problematic non-optional form.
After introducing `FiniteRecord`/`InfiniteRecord`, callers that pass `string` to
`ReadonlyRecord` should be migrated to `InfiniteRecord`.

### 2 — Fix sites in the codebase

Files to audit and update:

| File | Line(s) | Current | Action |
|------|---------|---------|--------|
| `fs/types/object/module.f.ts` | 16 | `Map<T>` = `{ readonly[k in string]: T }` | Add `?` |
| `fs/types/rtti/module.f.ts` | 61 | `Struct = { readonly[K in string]: Type }` | Add `?` |
| `fs/types/rtti/module.f.ts` | 54 | `ConstObject` inline `{ readonly[K in string]: Type }` | Add `?` |
| `fs/types/rtti/proof.f.ts` | 2 | `{ readonly[K in string]: readonly unknown[] }` | Add `?` |
| `fs/types/rtti/common/module.f.ts` | 105, 112 | `ReadonlyRecord<string, Unknown>` | Change to `InfiniteRecord<Unknown>` |
| `fs/types/rtti/validate/module.f.ts` | 130 | `ReadonlyRecord<string, Unknown>` | Change to `InfiniteRecord<Unknown>` |
| `fs/types/rtti/parse/module.f.ts` | 153 | `ReadonlyRecord<string, Unknown>` | Change to `InfiniteRecord<Unknown>` |
| `fs/djs/module.f.ts` | 20 | `{ readonly[k in string]: Unknown }` | Add `?` |
| `fs/djs/ast/module.f.ts` | 20 | `{ readonly[k in string]: AstConst }` | Add `?` |
| `fs/json/serializer/module.f.ts` | 11 | `{ readonly[k in string]: Unknown<T> }` | Add `?` |
| `fs/bnf/module.f.ts` | 49, 146 | `{ readonly[k in string]: Rule/TerminalRange }` | Add `?` |
| `fs/bnf/data/module.f.ts` | 35, 53, 75, 77 | various `{ [k in string]: ... }` | Add `?` |
| `fs/html/module.f.ts` | 65 | `{ readonly[k in string]: string }` | Add `?` |
| `fs/fsm/module.f.ts` | 28 | `{ readonly[state in string]: RangeMapArray<string> }` | Add `?` |
| `fs/dev/module.f.ts` | 28 | `{ readonly[k in string]: Module }` | Add `?` |
| `fs/effects/node/module.f.ts` | 130, 175 | `{ readonly[k in string]: string/unknown }` | Add `?` |

> **Note:** `{ readonly[K in string]: unknown }` and `{ readonly[K in string]: Unknown }`
> are technically safe since `undefined ⊆ unknown`, but the `?` is still correct style
> and should be added for consistency.

### 3 — Fix the runtime `printer` in `fs/types/ts/module.f.ts` — **done**

The `record` case in the printer used to emit `{readonly[k:string]:T}` (non-optional);
it now emits `{readonly[k:string]?:T}`:

```ts
// fs/types/ts/module.f.ts line 38
record: (type: string) => structX([`${ro}[k:string]?:${type}`]),
```

The JSDoc on line 26 and the `@example` strings in `fs/types/rtti/ts/module.f.ts`
(lines 157, 166) have been updated to match.

## Tasks

- [ ] Add `FiniteRecord<K, V>` and `InfiniteRecord<V>` to `fs/types/object/module.f.ts`
- [ ] Fix `Map<T>` in `fs/types/object/module.f.ts` to use `?`
- [ ] Fix rtti types (`Struct`, `ConstObject`, related) and migrate `ReadonlyRecord<string, …>`
- [ ] Fix `djs`, `json/serializer`, `bnf`, `html`, `fsm`, `dev`, `effects/node` usages
- [ ] Update downstream callers that relied on non-optional access (use `at()` or `definedValues`)
- [x] Fix `printer` in `fs/types/ts/module.f.ts` to emit `?` for record types
- [x] Update JSDoc and `@example` strings in `fs/types/ts/module.f.ts` and `fs/types/rtti/ts/module.f.ts`
- [ ] Add proof assertions verifying `FiniteRecord` / `InfiniteRecord` behave correctly
