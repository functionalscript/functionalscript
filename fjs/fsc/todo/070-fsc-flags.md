## 70. Flags for `fsc`.

**Priority:** P3
**Status:** open

1. `--tree`: a tree, no constants and references. It looks almost like JSON, except `export default`. This method is also used when the output file extension is `.json`.
2. `--js`: always clone mutable objects. bigint and string can be deduplicated.
3. `--fjs` (default behavior): deduplication of the same objects.
4. `--ca`: content-addressable deduplication.

### Tasks

- [ ] Until the flags exist, refuse arguments `compile` does not understand.
      `compile` in [`../module.f.mjs`](../module.f.mjs) checks only for fewer
      than two arguments and drops the rest, so at `36c8d4a`
      `fjs compile in.f.js out.json --tree --bogus` exits `0` as if `--tree`
      were honored
      ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
      A third argument should be an error that names it.
