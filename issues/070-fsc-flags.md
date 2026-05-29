# 70. Flags for `fsc`.

**Priority:** P3
**Status:** open

1. `--tree`: a tree, no constants and references. It looks almost like JSON, except `export default`. This method is also used when the output file extension is `.json`.
2. `--js`: always clone mutable objects. bigint and string can be deduplicated.
3. `--fjs` (default behavior): deduplication of the same objects.
4. `--ca`: content-addressable deduplication.
