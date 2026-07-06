## `orNotFound` step adapter

**Priority:** P4
**Status:** open

### Problem

`fileCas.list` (`fs/cas/module.f.ts:226-236`) spells out the three-way
`IoResult` policy inline: `ok → continue`, `ENOENT → benign default`,
`other error → throw`.

An earlier revision of this issue cited `read` as a second site, but `read`
now streams explicit error items and no longer uses this policy — `list` is
the only live site today. Per the second-consumer rule, implement this when
another site appears, or batch it with
[step-adapters](../../todo/step-adapters.md), which establishes the shape.

### Proposal

A **step adapter** (see [step-adapters](../../todo/step-adapters.md)): a
continuation factory passed to `.step`, not a wrapper taking the effect. The
wrapper shape proposed earlier — `orNotFound(effect)(notFound)(onOk)` —
recreates the nesting problem the moment two policies chain
(`orNotFound(orNotFound(…)…)`); the adapter chains flat and leaves `Effect`
unextended. Add it beside `isNotFound` in `fs/effects/node/module.f.ts`:

```ts
export const orNotFound =
    <N>(notFound: N) =>
    <T, O extends Operation, R>(onOk: (value: T) => Effect<O, R>) =>
    (r: IoResult<T>): Effect<O, R | N> => {
        if (r[0] === 'ok') { return onOk(r[1]) }
        if (isNotFound(r[1])) { return pure(notFound) }
        throw r[1]
    }
```

The CAS call site then carries only its differences:

```ts
list: () => access(storePrefix).step(orNotFound<readonly Vec[]>([])(() =>
    readdir(storePrefix, { recursive: true }).step(…)))
```

### Tasks

- [ ] Add `orNotFound` beside `isNotFound` in `fs/effects/node/module.f.ts`
      (once a second consumer exists, or as part of the step-adapters batch).
- [ ] Rewrite `list` in `fs/cas/module.f.ts` on top of it.
- [ ] Cover all three branches (`ok`, `ENOENT`, non-`ENOENT` throw) in `fs/effects/node/proof.f.ts`.

### Related

- [step-adapters](../../todo/step-adapters.md) — the helper-shape convention
  this follows; `okStep` is the two-way sibling of this three-way policy.
