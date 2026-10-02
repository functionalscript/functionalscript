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

This is `ToJson::object` today. [spread-operations](./spread-operations.md)
moves it, unchanged, into `Object::own_entries` and makes it the source of
every `{...o}`, so a spread of a large object pays it, and pays it again for
each spread of the same object. Measured with an object of distinct keys
spread through `spread_object([spread_entries(o)])`:

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
just to test and parse digits.

### Proposal

One pass over the property list: keep each key's last value and its first
position, in a structure with sub-linear lookup — a hash map from the key's
string to its slot, or the property indices sorted by key and the first-seen
order restored — then split the keys into array-index keys, sorted by value,
and the rest, as now. The `expect("key was just read …")` goes with the second
scan, since nothing is looked up again.

`array_index_value` reads the code units and accumulates into a `u64`, giving
up past `u32::MAX − 1`, so it allocates nothing.

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
- [ ] `array_index_value` without allocation.
- [ ] `ToJson::object` and `object_spread` keep calling the one view.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [spread-operations](./spread-operations.md) — the spread that puts this on a
  hot path.
- [hash-table-improvement](./hash-table-improvement.md) — the VM's own keyed
  structures.
- [to-json-array-index-scanner](./to-json-array-index-scanner.md) —
  `array_index_value`'s own task.
