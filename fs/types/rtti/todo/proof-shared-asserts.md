# Share result-assert helpers between validate and parse proofs

**Priority:** P4
**Status:** open

## Problem

`fs/types/rtti/validate/proof.f.ts:9-20` and
`fs/types/rtti/parse/proof.f.ts:9-25` define byte-identical helpers:

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

In addition, `parse/proof.f.ts:12-15` hand-rolls an `unwrap` that duplicates
`unwrap` from `fs/types/result/module.f.ts:59` (assert `'ok'`, return the
payload), and `assertErrorPath`/`assertDeepEqual`
(`parse/proof.f.ts:17-45`) still use raw `if`/`throw` instead of
`assert`/`assertEq`, contrary to the proof-assertion rule in `AGENTS.md`
(each local `if`/`throw` is a permanently-uncovered branch).

Beyond the helpers, roughly 80% of the two proof trees are copy-pasted
verbatim modulo the checker name (`validate` vs `parse`): the `boolean` /
`number` / `string` / `bigint` / `unknown` / `const` / `or` / `option` /
`path` / `recursive` suites (`validate/proof.f.ts:22-75,273-326` vs
`parse/proof.f.ts:47-100,295-345`). Only the container *success* cases
legitimately differ (validate asserts identity of the returned value; parse
asserts fresh construction and dropped extras via `assertDeepEqual`).

## Proposal

Two steps; the first is the high-confidence part:

1. **Shared helpers.**
   - `assertOk` / `assertError` are generic result-tag assertions on the
     repo-wide `Result` tuple convention; move them to
     `fs/asserts/module.f.ts` (type-only import of `Result` from
     `fs/types/result`, or structural `readonly [string, unknown]` to keep
     `fs/asserts` dependency-free).
   - Replace `parse/proof.f.ts`'s local `unwrap` with `unwrap` from
     `fs/types/result/module.f.ts`.
   - Rewrite `assertErrorPath` with `assertEq` (compare `e.path.length` and
     each element, or compare the joined path string), export it from one
     place both proofs can import — since `ValidationError` is owned by
     `validate` (parse already reuses it per `AGENTS.md`), exporting the
     helper from a small shared rtti proof-helper module (or from
     `validate/proof.f.ts`) keeps it next to the type it inspects.

2. **Suite factory (optional, larger).** Extract a
   `commonSuite(check: <T>(rtti: T) => (input: unknown) => Result<…>)`
   factory returning the shared `boolean`/`number`/…/`recursive` test tree,
   parameterized by `validate` / `parse`; each proof file spreads
   `...commonSuite(validate)` and adds only its divergent container-success
   cases. This mirrors the "inject the one thing that differs" shape that
   `fs/types/todo/172.md` proposes for the source-side container walkers.

## Tasks

- [ ] Move `assertOk`/`assertError` to `fs/asserts/module.f.ts` (with proof
      coverage) and update both rtti proofs.
- [ ] Replace parse/proof's local `unwrap` with `fs/types/result`'s `unwrap`.
- [ ] Rewrite `assertErrorPath` (and `assertDeepEqual`) on top of
      `assert`/`assertEq`; share `assertErrorPath` between the two proofs.
- [ ] Evaluate the `commonSuite` factory; if adopted, keep the two proof
      files down to their genuinely divergent cases.
- [ ] Run `npx tsc` and `fjs t`.

## Related

- `fs/types/todo/172.md` — source-side validate/parse container-walk
  deduplication; this issue is the proof-side counterpart and is
  independent of it.
- `AGENTS.md` proof-assertion rule — `assert`/`assertEq` over local
  `if`/`throw` in proof files.
