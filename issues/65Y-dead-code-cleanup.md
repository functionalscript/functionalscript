# 65Y-dead-code-cleanup. Remove unused exports and dead local types

**Priority:** P4
**Status:** done

> **Resolution:** items 1, 3, 4, and 6 deleted; items 2 and 5 had already been
> superseded (PR #886 added an `env` consumer; the `getConstants` eta-wrapper
> no longer exists — the current `fs/djs/serializer/module.f.ts:getConstants`
> inlines the walk itself). While removing the dead `Entry`/`Entries`/
> `MapEntries` aliases from `fs/json/serializer/module.f.ts`, the local
> `Obj`/`Arr`/`Primitive`/`Unknown` shapes those aliases were parameterized
> over also became unreferenced and were dropped in the same edit.

> **Update (post-#943):** `fs/io` no longer exists — it was folded into
> `fs/effects/node/module.ts` and deleted. Item 1's premise (the `Fs` import
> from `../../io/module.f.ts` in `fs/djs/parser`) is already resolved: that
> import is gone. Re-verify the remaining items against the current tree before
> acting; references to `fs/io/module.f.ts` below now mean
> `fs/effects/node/module.ts`. The `Io`-type cleanup is tracked separately in
> [i664-drop-io-interface](./664-drop-io-interface.md).

## Problem

Five small pockets of dead or near-dead code in `fs/` carry forward stale
shapes — some of which still pulled dependencies on the (now-removed)
`fs/io` module. The remediation is mechanical (delete, plus a couple
of imports).

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

### 2. ~~`env` in `fs/dev/module.f.ts:50`~~ — **withdrawn**

The original draft of this issue listed `env` from `fs/dev/module.f.ts`
as dead because no production module imported it. PR #886 has since
added test coverage in `fs/dev/proof.f.ts:59–72`, so `env` is now a
live export with a real consumer; the deletion no longer applies.

The function still depends on `Io` from the deprecated
`fs/io/module.f.ts`, so it remains a soft anchor for that module —
but resolving that is the job of
i65Y-io-type-duplication, not this
issue. Skip.

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

### 6. Dead type `Byte` in `fs/types/sorted_set/module.f.ts:35`

```ts
type Byte = number
```

- Declared but never referenced anywhere in the file (the only exports —
  `union`, `intersect`, `has` — are fully generic over `T`) and the type is
  not `export`ed, so no external consumer exists either. Pure scratch left
  over from an earlier byte-specific draft. Delete the line.

## Proposal

Five independent deletions, each a small PR (item 2 above was
withdrawn after PR #886 added test coverage for `env`):

1. Delete `ParseContext` and the `import type { Fs } from '../../io/...'`
   line in `fs/djs/parser/module.f.ts`.
2. Delete `Entry` / `Entries` / `MapEntries` plus the now-unused
   `import { type Entry as ObjectEntry }` and `import { type Reduce }`
   lines in `fs/json/serializer/module.f.ts`.
3. Delete `Entry` / `Entries` (keep `MapEntries`) in
   `fs/djs/serializer/module.f.ts`.
4. Replace `getConstants` with a direct call to `getConstantsOp` and
   delete the wrapper.
5. Delete the unused `type Byte = number` in
   `fs/types/sorted_set/module.f.ts`.

All five satisfy the AGENTS.md rule: *"If you are certain that something
is unused, you can delete it completely."*

## Why this qualifies

- **Separation of concerns / coupling reduction.** Item 1 is the only
  remaining `fs/io/...` import from `fs/djs/parser`. Removing it
  cleanly severs one of the live edges into the deprecated module
  without any code migration — it just deletes already-unused glue.
  Even if a broader `fs/io` removal is not yet planned, narrowing the
  surface helps that future effort.
- **Readability.** Items 2–4 are type-noise: future readers have to
  decide whether an unreferenced type is "load-bearing" public API or
  scratch work. Deleting answers the question.
- **No churn for callers.** Nothing imports any of the four items, so
  there are no downstream edits.

## Caveats / why this is an idea, not a mechanical edit

- **Public-API question for items 2 and 3.** The `MapEntries`-family
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
- **`env` is alive (PR #886).** The original draft listed `env` as
  the second item. Test coverage in `fs/dev/proof.f.ts` now exercises
  it, so it stays.

## Related

- [i157](./157-json-djs-shared-core.md) — the JSON/DJS shared-core
  extraction. Items 2 and 3 are pure dead code today; if i157 is
  picked up later, decide whether to re-introduce the `MapEntries`
  type as an exported alias at the same time.
- [i208](./208-try-catch-consolidate.md) — another `fs/io` cleanup
  item; item 1 here narrows the deprecated module's import surface
  and makes that consolidation easier.

- `fs/djs/parser/module.f.ts:12,16` — dead `ParseContext`.
- `fs/json/serializer/module.f.ts:86–90` — dead `Entry`/`Entries`/`MapEntries`.
- `fs/djs/serializer/module.f.ts:23–25` — dead `Entry`/`Entries`.
- `fs/djs/serializer/module.f.ts:69–73` — eta-wrapper `getConstants`.
- `fs/types/sorted_set/module.f.ts:35` — dead `Byte` type.
