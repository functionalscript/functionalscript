## own-entries-quadratic. An object's ordered entries cost quadratic time in its size

**Priority:** P3
**Status:** open

### Problem

An object's property list is never de-duplicated on construction, so every
reader that wants JavaScript's view of it — each key once, holding its last
value at its first position, array-index keys first — builds that view by
scanning:

- the distinct keys are collected with `keys.iter().any(|seen| seen == k)`,
  which is `O(n²)` in the number of properties;
- each key's value is then read by `own_property(&k)`, which scans the
  property list again, `O(n²)` more.

This is `Object::own_entries` (`vm/object/own_entries.rs`), the one view
`ToJson::object` and the object spread (`Any::object_spread`) both read, moved
unchanged out of `to_json` by [spread-operations](./spread-operations.md). It is
the source of every `{...o}`, so a spread of a large object pays it, and pays it again for
each spread of the same object. Measured at revision `f10b277` of `main`, in a
release build on one core, with an object of distinct keys `k0`, `k1`, … spread
through `spread_object([spread_entries(o)])` (`vm::unstable`), timed around that
call alone:

| keys | time |
|---|---|
| 5,000 | 33 ms |
| 20,000 | 0.47 s |
| 40,000 | 2.7 s |

Extrapolated, 100,000 keys is about seventeen seconds and a million does not
finish. A run that is correct but unbounded is a denial of service for a
program that spreads an object it received, which is a sandbox's whole
scenario.

`array_index_value` also collects a `Vec<u16>` and a `String` for every key
just to test and parse digits; that is
[to-json-array-index-scanner](./to-json-array-index-scanner.md)'s task, which
makes `array_index_value` the `u32::MAX` filter over the shared scanner, and
this one does not repeat it.

### Proposal

One pass over the property list: keep each key's last value and its first
position, in a structure with sub-linear lookup — a hash map from the key's
string to its slot, or the property indices sorted by key and the first-seen
order restored — then split the keys into array-index keys, sorted by value,
and the rest, as now. The `expect("key was just read …")` goes with the second
scan, since nothing is looked up again.

Hashing a `String` needs a hash on `String<A>` that agrees with its equality;
check what `IVm` already offers before adding one, and if the strings are
compared by content only through their code units, hash those.

### Tasks

- [ ] A benchmark-shaped test at 100,000 distinct keys that finishes in well
      under a second, and one with every key repeated, so a duplicate-heavy
      list is covered too.
- [ ] `own_entries` in one pass, with the existing order tests unchanged:
      duplicates, array-index keys in numeric order, `01` and `4294967295` as
      ordinary keys.
- [ ] `ToJson::object` and `object_spread` keep calling the one view.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [spread-operations](./spread-operations.md) — the spread that puts this on a
  hot path.
- [hash-table-improvement](./hash-table-improvement.md) — the VM's own keyed
  structures.
- [to-json-array-index-scanner](./to-json-array-index-scanner.md) —
  the shared array-index scanner, which also removes `array_index_value`'s
  allocation.
