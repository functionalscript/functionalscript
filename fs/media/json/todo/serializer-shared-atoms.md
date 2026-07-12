## serializer-shared-atoms. Share `colon` and a generic `MapEntries<P>` from `json/serializer`

**Priority:** P4
**Status:** open

### Problem

`fs/djs/serializer/module.f.ts` already imports the serializer atoms it
shares with JSON from `fs/media/json/serializer/module.f.ts` (line 15:
`objectWrap, arrayWrap, stringSerialize, numberSerialize, nullSerialize,
boolSerialize`) — but two pieces of the same property-serialization
vocabulary were left behind and re-declared instead:

**1. The `colon` chunk** is declared identically twice, used in the same
`stringSerialize(k), colon, f(v)` property fragment:

```ts
// fs/media/json/module.f.ts:70
const colon = [':']
// fs/djs/serializer/module.f.ts:17
const colon = [':']
```

**2. The entry-sorter type** is spelled twice, identical up to which
`Unknown` the entries carry:

```ts
// fs/media/json/module.f.ts:74-76
type Entries = List<Entry>
type MapEntries = (entries: Entries) => Entries
// fs/djs/serializer/module.f.ts:23
type MapEntries = (entries: List<ObjectEntry<Unknown>>) => List<ObjectEntry<Unknown>>
```

Both serializers thread it as their `sort`/`mapEntries` parameter (json
lines 79, 118; djs lines 94, 134, 138, 188, 207). Per `AGENTS.md`: when a
sibling module already has the type or helper, export it from the owner
rather than duplicating. Two real consumers exist for both atoms.

### Proposal

In `fs/media/json/serializer/module.f.ts`, next to `objectWrap`/`arrayWrap`:

```ts
export const colon: List<string> = [':']

export type MapEntries<P> = (entries: List<ObjectEntry<P>>) => List<ObjectEntry<P>>
```

`fs/media/json/module.f.ts` imports `colon` and instantiates
`MapEntries<Unknown>` (json's `Unknown`); `fs/djs/serializer` imports both
and instantiates `MapEntries<Unknown>` (djs's `Unknown`). The two local
declarations are deleted. The leaf parameterization composes with
[663-json-djs-tree-type](../../djs/todo/663-json-djs-tree-type.md), which
unifies the value types the same way but does not cover `MapEntries`.

### Tasks

- [ ] Export `colon` and `MapEntries<P>` from `fs/media/json/serializer`.
- [ ] Delete the local copies in `fs/media/json/module.f.ts` and
      `fs/djs/serializer/module.f.ts`; import instead.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- [663-json-djs-tree-type](../../djs/todo/663-json-djs-tree-type.md) —
  same json⊂djs leaf-parameterization direction for the value types.
- [157](../../djs/todo/157.md) — factors the recursive walker; does not
  cover these atoms.
