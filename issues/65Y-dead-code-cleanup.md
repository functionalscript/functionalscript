# 65Y-dead-code-cleanup. Remove unused exports and dead local types

**Priority:** P4
**Status:** open

## Problem

Five small pockets of dead or near-dead code in `fs/` carry forward stale
shapes — some of which still pull dependencies on the deprecated
`fs/io/module.f.ts`. The remediation is mechanical (delete, plus a couple
of imports), but the cleanup is worth filing because two of the dead
items keep the deprecated module artificially alive at the type level.

### 1. `ParseContext` in `fs/djs/parser/module.f.ts:16`

```ts
import type { Fs } from '../../io/module.f.ts'

export type ParseContext = {
    readonly fs: Fs
    readonly complete: OrderedMap<Result<AstModule, string>>
    readonly stack: List<string>
}
```

- The only `from '.../djs/parser/...'` import in the repo is in
  `fs/djs/transpiler/module.f.ts:13`, which imports `parseFromTokens` and
  `ParseError` — not `ParseContext`.
- The transpiler defines its **own**, structurally different
  `ParseContext` (`fs/djs/transpiler/module.f.ts:26`) that does not
  reference `Fs` at all and uses `complete: OrderedMap<djsResult>`
  instead of `OrderedMap<Result<AstModule, string>>`.
- Removing the export also drops the only `fs/io/...` import from
  `fs/djs/parser/module.f.ts`.

### 2. `env` in `fs/dev/module.f.ts:50`

```ts
import type { Io } from '../io/module.f.ts'

export const env
    : (io: Io) => (v: string) => string|undefined
    = ({ process: { env } }) => a => {
        const r = Object.getOwnPropertyDescriptor(env, a)
        return r === undefined ? undefined :
            typeof r.get === 'function' ? r.get() :
                r.value
    }
```

- `grep -rn "from '.*dev/module.f.ts'" fs/` finds 7 importers; none of
  them imports `env`. The `Env` *type* used by `loadModuleMap` comes
  from `fs/types/effects/node/module.f.ts`, not from this `env`
  helper.
- Removing the export drops the `Io` import — the only reference to
  the deprecated `fs/io/...` from `fs/dev/module.f.ts`.

### 3. Dead types in `fs/json/serializer/module.f.ts:86–90`

```ts
type Entry<T> = ObjectEntry<Unknown<T>>
type Entries<T> = List<Entry<T>>
type MapEntries<T> = (entries: Entries<T>) => Entries<T>
```

- None of the three are `export`ed and none are referenced inside the
  file. The `Unknown<T>` generic shape they parameterize over is only
  declared and used internally; the exported API
  (`stringSerialize`, `numberSerialize`, `nullSerialize`,
  `boolSerialize`, `objectWrap`, `arrayWrap`) does not use them.
- The `import { type Entry as ObjectEntry }` and
  `import { type Reduce }` lines also become orphan imports once the
  types go.

### 4. Dead types in `fs/djs/serializer/module.f.ts:23–25`

```ts
type Entry = ObjectEntry<Unknown>
type Entries = List<Entry>
type MapEntries = (entries: Entries) => Entries
```

- `MapEntries` *is* used (lines 80, 118, 200, 219). `Entry` and `Entries`
  are not referenced anywhere in the file or by importers.

### 5. `getConstants` eta-wrapper in `fs/djs/serializer/module.f.ts:69`

```ts
const getConstants
    : Fold<Unknown, GetConstsState>
    = djs => refs => {
        return getConstantsOp(djs)(refs)
    }
```

- Pure eta-expansion of `getConstantsOp`. The only call site is
  `stringify` (line 203). Either alias (`const getConstants = getConstantsOp`)
  or inline at the call site — there is no behavioural reason to keep
  the wrapper.

## Proposal

Five independent deletions, each a small PR:

1. Delete `ParseContext` and the `import type { Fs } from '../../io/...'`
   line in `fs/djs/parser/module.f.ts`.
2. Delete `env` and the `import type { Io } from '../io/...'` line in
   `fs/dev/module.f.ts`.
3. Delete `Entry` / `Entries` / `MapEntries` plus the now-unused
   `import { type Entry as ObjectEntry }` and `import { type Reduce }`
   lines in `fs/json/serializer/module.f.ts`.
4. Delete `Entry` / `Entries` (keep `MapEntries`) in
   `fs/djs/serializer/module.f.ts`.
5. Replace `getConstants` with a direct call to `getConstantsOp` and
   delete the wrapper.

All five satisfy the AGENTS.md rule: *"If you are certain that something
is unused, you can delete it completely."*

## Why this qualifies

- **Separation of concerns / coupling reduction.** Items 1 and 2 are
  the only remaining `fs/io/...` imports from `fs/djs/parser` and
  `fs/dev` respectively. Removing them cleanly severs two of the four
  live edges into the deprecated module without any code migration —
  it just deletes already-unused glue. Even if a broader `fs/io`
  removal is not yet planned, narrowing the surface helps that future
  effort.
- **Readability.** Items 3–5 are type-noise: future readers have to
  decide whether an unreferenced type is "load-bearing" public API or
  scratch work. Deleting answers the question.
- **No churn for callers.** Nothing imports any of the five items, so
  there are no downstream edits.

## Caveats / why this is an idea, not a mechanical edit

- **Public-API question for items 3 and 4.** The `MapEntries`-family
  types in both serializers look intended for an external "sort entries
  before serializing" hook. The exported `serialize` / `stringify` /
  `stringifyAsTree` signatures already inline that callback type
  (`(entries: …) => …`), so the named aliases add nothing today, but
  re-exporting `MapEntries` could become useful when the i157
  json/djs core extraction lands. Confirm with the author whether the
  aliases are reserved for that work before deleting; if so, `export`
  them and use them in the signatures instead.
- **`getConstants` rename vs inline.** The wrapper currently has the
  exact same type as `getConstantsOp`. Inlining is the smallest
  change; if the author prefers the name for readability at the call
  site, alias-bind (`const getConstants = getConstantsOp`) without
  the lambda indirection.

## Related

- [i157](./157-json-djs-shared-core.md) — the JSON/DJS shared-core
  extraction. Items 3 and 4 are pure dead code today; if i157 is
  picked up later, decide whether to re-introduce the `MapEntries`
  type as an exported alias at the same time.
- [i208](./208-try-catch-consolidate.md) — another `fs/io` cleanup
  item; items 1 and 2 here narrow the deprecated module's import
  surface and make that consolidation easier.

- `fs/djs/parser/module.f.ts:12,16` — dead `ParseContext`.
- `fs/dev/module.f.ts:6,50` — dead `env`.
- `fs/json/serializer/module.f.ts:86–90` — dead `Entry`/`Entries`/`MapEntries`.
- `fs/djs/serializer/module.f.ts:23–25` — dead `Entry`/`Entries`.
- `fs/djs/serializer/module.f.ts:69–73` — eta-wrapper `getConstants`.
