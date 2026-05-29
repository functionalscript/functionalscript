# 161. `string_set` and `ordered_map`: a shared keyed B-tree collection

**Priority:** P3
**Status:** open

`fs/types/string_set/module.f.ts` and `fs/types/ordered_map/module.f.ts` are
parallel thin wrappers over the same B-tree primitives
(`btree/find`, `btree/set`, `btree/remove`, `btree/module`) keyed by the same
string comparator (`string/module.f.ts` `cmp`). A set is logically a map whose
key *is* its value, and that relationship shows up directly in the code.

```ts
// string_set — key === value
export const contains = value => { const f = find(cmp(value)); return s => s !== null && isFound(f(s).first) }
export const set      = value => btreeSet(cmp(value))(() => value)
export const remove   = compose(cmp)(btreeRemove)
export const values   = btValues
export const empty    = btEmpty

// ordered_map — key is entry[0]
const keyCmp  = a => ([b]) => cmp(a)(b)
export const at      = name => map => { … value(find(keyCmp(name))(map).first) … }
export const setReplace = name => value => setReduceEntry(replace)([name, value])  // wraps btreeSet
export const remove  = name => btreeRemove(keyCmp(name))
export const entries = values
export const empty   = null
```

Both define a string-keyed comparator (`cmp(value)` vs `keyCmp`), delegate
find/set/remove/values to `btree`, and expose `empty = null`. `string_set` is
the `key === value` specialization of the keyed collection that `ordered_map`
generalizes with `[key, value]` entries.

## Proposed abstraction

A single keyed-B-tree-collection factory parameterized by the key extractor and
key comparator:

```ts
const keyedCollection = <K, V>(keyOf: (v: V) => K, keyCmp: (a: K) => (b: K) => Sign) => ({
    contains: (k: K) => /* find via keyCmp(k) ∘ keyOf */,
    find:     (k: K) => …,
    set:      (v: V) => btreeSet(cmpBy(keyOf, keyCmp)(keyOf(v)))(…),
    remove:   (k: K) => btreeRemove(…),
    values,
    empty: null,
})
```

- `string_set` = `keyedCollection<string, string>(identity, stringCmp)`
- `ordered_map<T>` = `keyedCollection<string, Entry<T>>(fst, stringCmp)` plus
  its `setReduce`/`setReplace`/`at` value-layer conveniences on top.

Both consumers already exist: `ordered_map` is used widely (`object`,
`json/parser`, `djs/parser`, `bnf/data`, `js/tokenizer`); `string_set` is used
by `bnf/data`. So extracting now satisfies the second-consumer rule.

## Caveats / why this is an idea, not a mechanical edit

- **Value asymmetry.** A set has no value; a map's value participates in
  `setReduce` (combining on collision). The factory must either expose the raw
  `btreeSet(cmp)(update)` and let each wrapper decide the update function, or
  model the set as `OrderedMap<null>` and re-expose a value-free surface. The
  former keeps `string_set`'s storage compact (the value *is* the key, no
  `[k, v]` tuple); the latter is simpler but doubles `string_set`'s storage.
  This is a design call worth deciding before implementing.
- Keep `ordered_map`'s `setReduce`/`setReplace`/`at`/`fromEntries` as a thin
  value-layer over the shared core rather than pushing them into the factory.

The mechanical win is modest; the value is architectural — making explicit that
"set" and "ordered map" are one structure, so future ordered collections (e.g.
an ordered multiset) reuse the core instead of forking a third wrapper.

## Related

- [i37](./README.md) — language-level `Map`/reference containers; a unified
  keyed-collection core informs that direction.
