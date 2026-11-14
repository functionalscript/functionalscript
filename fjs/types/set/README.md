# Persistent set

`empty`, `add(value)(set)`, `has(value)(set)`, `size(set)`, `values(set)` and
`fromValues(array)` provide a persistent SameValueZero set. Adding an existing
value returns the exact original handle; adding a new value preserves older
versions.

`values` keeps first-insertion order, so `values(fromValues(input))` is stable
deduplication. Objects and functions compare by identity, even when their
contents agree. NaN equals NaN, both signed zeros are stored as positive zero,
and values of different primitive types remain distinct.

The implementation reuses the [persistent map](../map/README.md), storing
`true` for membership. Reference lookup uses RefMap and primitive lookup uses
the existing ordered map, with an insertion-ordered B-tree for enumeration.
Updates copy search paths rather than the whole collection. The RefMap
executor bounds and unsupported symbol-key contract are the map's.
