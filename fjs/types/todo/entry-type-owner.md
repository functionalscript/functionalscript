## entry-type-owner. `Entry<T>` has two identical definitions and four meanings

**Priority:** P4
**Status:** open

### Problem

Two modules define the same string-keyed entry type independently:

```ts
// object/types.ts:62
export type Entry<T> = readonly[string, T]
// ordered_map/types.ts:9
export type Entry<T> = readonly [string, T]
```

and one module silently passes values across the boundary:
`object/module.f.mjs`'s `sort` is typed with *object*'s `Entry` while its
body is entirely `ordered_map` functions typed with *ordered_map*'s
`Entry` (`sort = e => mapEntries(mapFromEntries(e))`). It type-checks
only because the two aliases are structurally identical, and nothing
states that dependency — a change to either (a third slot, a record
shape) breaks the other at a distance. Downstream importers already
disambiguate by hand (`fjs/media/json/types.ts` imports
`Entry as ObjectEntry`).

Two further `Entry<T>` in this subtree mean unrelated things —
`list/types.ts:46` is `readonly [number, T]` (index/value) and
`range_map/types.ts:11` is `readonly [T, number]` (value/upper bound, the
*reverse* tuple) — so the name alone tells a reader nothing about the
shape.

### Proposal

Pick one owner for the string-keyed entry — `ordered_map` is the natural
home, since `OrderedMap<T> = Tree<Entry<T>>` is defined in terms of it —
and have `object/types.ts` re-export it, so existing importers are
unaffected and `object`'s conversion functions are typed with the type
they actually manipulate. Independently, rename the two unrelated tuples
to say what they are (`list`'s toward `Indexed<T>`, `range_map`'s toward
a bounded/up-to name), so `Entry` names one concept in the subtree
rather than four. Breaking renames are fine when they improve the API;
update every importer in the same PR.

### Tasks

- [ ] Make `ordered_map` the owner; re-export from `object/types.ts`.
- [ ] Rename `list`'s and `range_map`'s tuples; update importers.
- [ ] `tsc`, `fjs test`.

### Related

- [161-shared-keyed-btree-collection.md](./161-shared-keyed-btree-collection.md)
  — a shared collection factory over `[key, value]` entries; one shared
  entry type is a prerequisite it currently assumes silently.
