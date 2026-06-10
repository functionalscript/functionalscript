# 66A-emergent-add-result. Merge `addPass` / `addFail` into one `TestState` updater

**Priority:** P5
**Status:** open

## Problem

`fs/emergent_testing/module.f.ts` defines two `TestState` updaters that are
identical except for the counter field they increment:

```ts
// fs/emergent_testing/module.f.ts:43-47
const addPass = (delta: number) => (ts: TestState): TestState =>
    ({ ...ts, time: ts.time + delta, pass: ts.pass + 1 })

const addFail = (delta: number) => (ts: TestState): TestState =>
    ({ ...ts, time: ts.time + delta, fail: ts.fail + 1 })
```

where

```ts
// :37-41
type TestState = {
    readonly time: number,
    readonly pass: number,
    readonly fail: number,
}
```

The two bodies share the spread, the `time: ts.time + delta` accumulation, and
the `+ 1` increment; they differ only in whether `pass` or `fail` is the
incremented key. This is the "same algorithm, one varying constant" shape that
DRY targets — and if a third outcome counter were ever added (e.g. `skip`), the
copy would multiply.

Both helpers are real, exercised code: `addPass(duration)(zero)` /
`addFail(duration)(zero)` feed the `runModule` walk
(`fs/emergent_testing/module.f.ts:199-205`).

## Proposal

Parameterize over the counter key with a typed computed property, keeping the
type checker's exhaustiveness (`'pass' | 'fail'` is a closed union, so a typo
is a compile error):

```ts
const addResult = (key: 'pass' | 'fail') => (delta: number) => (ts: TestState): TestState =>
    ({ ...ts, time: ts.time + delta, [key]: ts[key] + 1 })

const addPass = addResult('pass')
const addFail = addResult('fail')
```

The two named helpers are kept as point-free derivations so every call site
(`addPass(duration)(zero)`, `addFail(duration)(zero)`) is unchanged and still
reads at the grammar level. No `as` cast is needed — `ts[key]` is `number` for
both members of the union, and the computed-key literal is checked against the
`TestState` shape.

This is a small, single-module change. It is borderline against the AGENTS.md
DRY-vs-readability guidance (the originals are short and clear), which is why
it is filed at **P5** — worth doing if the file is being touched anyway, or as
a prerequisite if a third counter is introduced, but not on its own.

## Tasks

- [ ] Replace `addPass` / `addFail` with the `addResult` factory + two
      derivations in `fs/emergent_testing/module.f.ts`.
- [ ] Confirm `fs/emergent_testing` proofs still pass (`fjs t`) with full
      branch coverage and `npx tsc` is clean.

## Related

- [i65Z-tf-test-tree-walker](./65Z-tf-test-tree-walker.md) — adjacent
  `fs/emergent_testing` DRY cleanup (sharing the dynamic test-tree walk between
  `runModule` and `registerModule`). Same module; independent change. Note that
  walker also consumes `addPass`/`mergeState`, so landing this first keeps the
  updater surface stable for that refactor.
