# 66C-infinite-record. Use `?` for Infinite-Key Mapped Types

**Priority:** P2
**Status:** done

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

### 1 — Helper type in `fs/types/object/module.f.ts`

Instead of two separate aliases, use a single conditional type that handles both cases:

```ts
export type StringMap<K extends string, T> =
    string extends K
    ? { readonly[k in string]?: T }   // infinite key set — optional
    : { readonly[k in K]: T }          // finite key set — all keys required
```

- `StringMap<string, T>` → `{ readonly[k in string]?: T }` (infinite, optional)
- `StringMap<'a' | 'b', T>` → `{ readonly[k in 'a' | 'b']: T }` (finite, required)

**Status:** implemented in `fs/types/object/module.f.ts`.

The existing `ReadonlyRecord<S, T>` callers that pass `string` should be migrated to
`StringMap<string, T>`.

> **Note:** `StringMap<string, T>` cannot be used as an alias for mutually-recursive
> types (e.g. `Object = StringMap<string, Unknown>` where `Unknown` contains `Object`)
> because TypeScript's circular-reference detection does not resolve through conditional
> types. Use the inline form `{ readonly[k in string]?: T }` for such cases.

### 2 — Fix sites in the codebase

Files to audit and update (migrate inline `{ readonly[k in string]: T }` to `StringMap<string, T>`):

| File | Line(s) | Current | Action | Status |
|------|---------|---------|--------|--------|
| `fs/types/object/module.f.ts` | 16 | `Map<T>` = `{ readonly[k in string]: T }` | `Map<T> = StringMap<string, T>` | done |
| `fs/types/rtti/module.f.ts` | 61 | `Struct = { readonly[K in string]: Type }` | `StringMap<string, Type>` | done |
| `fs/types/rtti/module.f.ts` | 54 | `ConstObject` inline `{ readonly[K in string]: Type }` | `StringMap<string, Type>` | done |
| `fs/types/rtti/proof.f.ts` | 2 | `{ readonly[K in string]: readonly unknown[] }` | `StringMap<string, ...>` | done |
| `fs/types/rtti/common/module.f.ts` | 105, 112 | `ReadonlyRecord<string, Unknown>` | `StringMap<string, Unknown>` | done |
| `fs/types/rtti/validate/module.f.ts` | 130 | `ReadonlyRecord<string, Unknown>` | `StringMap<string, Unknown>` | done |
| `fs/types/rtti/parse/module.f.ts` | 153 | `ReadonlyRecord<string, Unknown>` | `StringMap<string, Unknown>` | done |
| `fs/djs/module.f.ts` | 20 | `{ readonly[k in string]: Unknown }` | inline `?` (recursive type) | done |
| `fs/djs/ast/module.f.ts` | 20 | `{ readonly[k in string]: AstConst }` | inline `?` (recursive type) | done |
| `fs/json/serializer/module.f.ts` | 11 | `{ readonly[k in string]: Unknown<T> }` | inline `?` (recursive type) | done |
| `fs/bnf/module.f.ts` | 49 | `Variant = { readonly[k in string]: Rule }` | inline `?` (recursive type) | done |
| `fs/bnf/module.f.ts` | 146 | `RangeVariant = { readonly[k in string]: TerminalRange }` | `StringMap<string, TerminalRange>` | done |
| `fs/bnf/data/module.f.ts` | 35, 53, 75, 77 | various `{ [k in string]: ... }` | `StringMap<string, ...>` | done |
| `fs/html/module.f.ts` | 65 | `{ readonly[k in string]: string }` | `StringMap<string, string>` | done |
| `fs/fsm/module.f.ts` | 28 | `{ readonly[state in string]: RangeMapArray<string> }` | `StringMap<string, ...>` | done |
| `fs/dev/module.f.ts` | 28 | `{ readonly[k in string]: Module }` | `StringMap<string, Module>` | done |
| `fs/effects/node/module.f.ts` | 145, 191 | `{ readonly[k in string]: string/unknown }` | `StringMap<string, ...>` | done |

> **Note:** `{ readonly[K in string]: unknown }` and `{ readonly[K in string]: Unknown }`
> are technically safe since `undefined ⊆ unknown`, but the `?` is still correct style
> and should be added for consistency.

### 3 — Fix the runtime `printer` in `fs/types/ts/module.f.ts` — **done**

The `record` case in the printer used to emit `{readonly[k:string]:T}` (non-optional);
it now emits `{readonly[k in string]?:T}` — mapped-type syntax, since an optional
index signature (`[k:string]?:`) is not valid TypeScript:

```ts
// fs/types/ts/module.f.ts
record: (type: string) => structX([`${ro}[k in string]?:${type}`]),
```

The JSDoc on line 26 and the `@example` strings in `fs/types/rtti/ts/module.f.ts`
(lines 157, 166) have been updated to match.

## Tasks

- [x] Add `StringMap<K, T>` to `fs/types/object/module.f.ts` (alternative to `FiniteRecord`/`InfiniteRecord`)
- [x] Fix rtti types (`Struct`, `ConstObject`, related) and migrate `ReadonlyRecord<string, …>` to `StringMap<string, …>`
- [x] Fix `printer` in `fs/types/ts/module.f.ts` to emit `?` for record types
- [x] Update JSDoc and `@example` strings in `fs/types/ts/module.f.ts` and `fs/types/rtti/ts/module.f.ts`
- [x] Fix `Map<T>` in `fs/types/object/module.f.ts` (`Map<T> = StringMap<string, T>`)
- [x] Fix `djs`, `json/serializer`, `bnf`, `html`, `fsm`, `dev`, `effects/node` usages (see table above)
- [x] Fix `fs/types/rtti/proof.f.ts` inline mapped type
- [x] Update downstream callers that relied on non-optional access (`!` assertions and `definedValues`/`definedEntries`)
- [x] Add proof assertions verifying `StringMap` behaves correctly for finite and infinite key sets
