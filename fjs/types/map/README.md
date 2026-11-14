# Persistent map

`empty`, `mapGet(map, key)`, `mapHas(map, key)`, `mapSet(map, key, value)`,
`mapDelete(map, key)`, `mapEntries(map)` and `size(map)` operate on
`PersistentMap<K, V>`. Updates preserve older versions. `mapHas` distinguishes
an absent key from a present key whose value is `undefined`.

Keys use SameValueZero: references compare by identity, NaN equals NaN, and
both signed zeros are stored as positive zero. Primitive types remain
separate, so `1`, `1n` and `'1'` are three keys. All FunctionalScript values
can be keys.

Entries keep first-insertion order. Updating a value keeps its position;
deleting and reinserting a key appends it. The result of `mapEntries` is an
array of pairs, rather than a native Map or an iterator.

Reference keys use the existing [RefMap](../ref_map/module.f.js); primitive
keys use type-tagged strings in [OrderedMap](../ordered_map/module.f.js).
Both indexes point to insertion ids in a persistent [B-tree](../btree/README.md)
whose slots contain the keys and values, including `undefined`. Deleting a
reference writes a private tombstone in its index and removes its live slot.
The reference map can retain historical key ids; its documented bounds use
historical distinct keys, and its current EDAG fallback is a linear scan.

On source JavaScript and NaNVM, lookup and updates take logarithmic tree
work. Enumeration traverses the live slots in order and materializes the
result through the shared list fold. No native Map or Set operation is needed. `mapDelete` of an absent key returns the original map handle.
