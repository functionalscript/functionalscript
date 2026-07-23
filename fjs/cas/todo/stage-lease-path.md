## stage-lease-path. Fresh staging-path combinator for the lease-deadline rule

**Priority:** P4
**Status:** open

### Problem

`fileCas.write` derives "a fresh staging path whose embedded deadline is
`now() + leaseDelta`" in two places in `fjs/cas/module.f.ts` — once before the
chunk loop (initial `createExclusive`) and once inside it (per-chunk lease
renewal):

```ts
// initial create (:210-213)
now()
.step(t0 => {
    const path0 = join(stageDir, stageName(t0 + leaseDelta, rndStr))
    return createExclusive(path0)

// lease renewal (:198-201)
return now()
.step(t => {
    const next = join(stageDir, stageName(t + leaseDelta, rndStr))
    return rename(curPath, next).step(...)
```

Both spell out the same three-part invariant — read the clock, add
`leaseDelta`, build `join(stageDir, stageName(deadline, rndStr))` — so the
lease-deadline naming rule lives in two copies that must stay in sync, while
its inverse (`deadlineOf`) already lives in exactly one place.

### Proposal

A closed module-scope combinator beside `stageName`/`deadlineOf`, which
already own the other half of the naming rule:

```ts
/** A staging path whose embedded deadline is `leaseDelta` ms in the future. */
const freshStagePath = (stageDir: string) => (rndStr: string): Effect<Now, string> =>
    now().step(t => pure(join(stageDir, stageName(t + leaseDelta, rndStr))))
```

The initial create becomes
`freshStagePath(stageDir)(rndStr).step(path0 => createExclusive(path0)…)` and
the renewal becomes
`freshStagePath(stageDir)(rndStr).step(next => rename(curPath, next)…)`, with
`freshStagePath(stageDir)(rndStr)` applied once where both are in scope. The
lease-deadline path rule then exists once, next to its inverse.

### Tasks

- [ ] Add the `freshStagePath` helper to `fjs/cas/module.f.ts` and rewrite both
      sites through it.
- [ ] `npx tsc`, `fjs t`; existing CAS proofs pass unchanged.

### Related

- [write-closed-helpers.md](./write-closed-helpers.md) — hoists `publish`,
  `fail`, and the chunk loop; the two lease-path sites straddle the loop
  boundary, so they remain two spellings even after that lands. Orthogonal;
  coordinate if both are picked up together.
- [../../effects/todo/fold-stream-combinator.md](../../effects/todo/fold-stream-combinator.md)
  — captures the loop skeleton, not the lease-path rule.
- [../../../todo/cas/staging-lease.md](../../../todo/cas/staging-lease.md) —
  the lease design this rule implements.
