# Share result-assert helpers between validate and parse proofs

**Priority:** P4
**Status:** open

## Problem

`fjs/types/rtti/validate/proof.f.mjs:13-29` and
`fjs/types/rtti/parse/proof.f.mjs:13-38` define byte-identical helpers:

```ts
const assertOk = ([k]: readonly [string, unknown]) => { assertEq(k, 'ok', 'expected ok') }
const assertError = ([k]: readonly [string, unknown]) => { assertEq(k, 'error', 'expected error') }
const assertErrorPath = (expected: readonly string[]) =>
    (r: readonly [string, unknown]) => {
        assert(r[0] === 'error', 'expected error')
        const e = r[1] as ValidationError
        if (e.path.length !== expected.length) { throw `path length ${e.path.length} != ${expected.length}` }
        ...
    }
```

In addition, `parse/proof.f.mjs` hand-rolls an `unwrap` that duplicates
`unwrap` from `fjs/types/result/module.f.mjs:59` (assert `'ok'`, return the
payload).

`assertDeepEqual` is **done**: `structurallySame` / `assertStructurallySame`
landed and `assertDeepEqual` is deleted in favour of it. `assertErrorPath` is
only **half-migrated**: `parse/proof.f.mjs`'s copy is now
`assertStructurallySame(e.path, expected, 'unexpected error path')`, but
`validate/proof.f.mjs`'s copy still has the raw `if`/`throw` loop shown above.
What remains below is migrating `validate/proof.f.mjs`'s `assertErrorPath`,
the `unwrap` duplication, the `assertOk`/`assertError` move, and sharing
`assertErrorPath` itself between the two proofs.

Beyond the helpers, roughly 80% of the two proof trees are copy-pasted
verbatim modulo the checker name (`validate` vs `parse`): the `boolean` /
`number` / `string` / `bigint` / `unknown` / `const` / `or` / `option` /
`path` / `recursive` suites (`validate/proof.f.mjs:29-83,280-334` vs
`parse/proof.f.mjs:60-113,311-362`). Only the container *success* cases
legitimately differ (validate asserts identity of the returned value; parse
asserts fresh construction and dropped extras via `assertStructurallySame`).

## Proposal

Two steps; the first is the high-confidence part:

1. **Shared helpers.**
   - `assertOk` / `assertError` are generic result-tag assertions on the
     repo-wide `Result` tuple convention; move them to
     `fjs/asserts/module.f.mjs` (type-only import of `Result` from
     `fjs/types/result`, or structural `readonly [string, unknown]` to keep
     `fjs/asserts` dependency-free).
   - Replace `parse/proof.f.mjs`'s local `unwrap` with `unwrap` from
     `fjs/types/result/module.f.mjs`.
   - Export `assertErrorPath` (already rewritten on `assertStructurallySame`)
     from one place both proofs can import — since `ValidationError` is owned by
     `validate` (parse already reuses it per `AGENTS.md`), exporting the
     helper from a small shared rtti proof-helper module (or from
     `validate/proof.f.mjs`) keeps it next to the type it inspects.

2. **Suite factory (optional, larger).** Extract a
   `commonSuite(check: <T>(rtti: T) => (input: unknown) => Result<…>)`
   factory returning the shared `boolean`/`number`/…/`recursive` test tree,
   parameterized by `validate` / `parse`; each proof file spreads
   `...commonSuite(validate)` and adds only its divergent container-success
   cases. This mirrors the "inject the one thing that differs" shape that
   `fjs/types/rtti/todo/172.md` proposes for the source-side container walkers.

## Tasks

- [ ] Move `assertOk`/`assertError` to `fjs/asserts/module.f.mjs` (with proof
      coverage) and update both rtti proofs.
- [ ] Replace parse/proof's local `unwrap` with `fjs/types/result`'s `unwrap`.
- [x] Delete `assertDeepEqual` in favour of `assertStructurallySame`.
- [ ] Rewrite `validate/proof.f.mjs`'s `assertErrorPath` on top of
      `assertStructurallySame` — `parse/proof.f.mjs`'s copy already is, but
      `validate/proof.f.mjs`'s still has the raw `if`/`throw` loop.
- [ ] Share the rewritten `assertErrorPath` between the two proofs.
- [ ] Evaluate the `commonSuite` factory; if adopted, keep the two proof
      files down to their genuinely divergent cases.
- [ ] Run `npx tsc` and `fjs t`.

## Related

- `fjs/types/rtti/todo/172.md` — source-side validate/parse container-walk
  deduplication; this issue is the proof-side counterpart and is
  independent of it.
- `AGENTS.md` proof-assertion rule — `assert`/`assertEq` over local
  `if`/`throw` in proof files.
- `fjs/types/object/structurally_same/README.md` — `structurallySame` /
  `assertStructurallySame`, which replaced this issue's `assertDeepEqual`
  subtask.
