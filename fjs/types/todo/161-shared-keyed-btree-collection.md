## 161. `string_set` and `ordered_map`: a shared keyed B-tree collection

**Priority:** P3
**Status:** open

`fjs/types/string_set/module.f.mjs` and `fjs/types/ordered_map/module.f.mjs` are
parallel thin wrappers over the same B-tree primitives
(`btree/find`, `btree/set`, `btree/remove`, `btree/module`) keyed by the same
string comparator (`string/module.f.mjs` `cmp`). A set is logically a map whose
key *is* its value.

### Done

The lookup both collections duplicated — run `btree/find` with a comparator and
handle the empty tree — has one owner,
[`btree/find`](../btree/find/module.f.js): `findValue` (the matched value or
`null`) and `contains`, both over a possibly empty `Tree<T>`.
`string_set.contains` is `contains ∘ cmp`, and `ordered_map.at` is `findValue`
with its entry-key comparator plus the projection to the entry's value.

### What remains

A single keyed-collection factory, parameterized by a key extractor and key
comparator, that both modules are built from:

- `string_set` = `keyedCollection<string, string>(identity, stringCmp)`
- `ordered_map<T>` = `keyedCollection<string, Entry<T>>(fst, stringCmp)` plus
  its `setReduce`/`setReplace`/`at`/`fromEntries` value layer on top.

It was not done with the lookup extraction because it costs more than the
duplication it would remove:

- **Generics.** `ordered_map`'s operations are generic per call
  (`(name: string) => <T>(map: OrderedMap<T>) => …`). A factory instantiated once
  at module scope fixes `V = Entry<T>` there, so each operation would have to be
  re-annotated or re-wrapped to stay generic, which is the duplication again.
- **Little left to share.** With lookup extracted, `set` and `remove` are already
  one-liners over `btree/set` and `btree/remove` with each module's comparator,
  and `values`/`empty` are re-exports of `btree/module`.
- **Value asymmetry.** A set has no value; a map's value participates in
  `setReduce` (combining on collision). The factory must either expose the raw
  `btreeSet(cmp)(update)` and let each wrapper decide the update function, or
  model the set as `OrderedMap<null>`, which doubles `string_set`'s storage.

Worth revisiting when a third ordered collection (e.g. an ordered multiset)
would otherwise fork another wrapper.

### Related

- [i37](../../../todo/037-language-design-map.md) — language-level `Map`/reference containers; a unified
  keyed-collection core informs that direction.
