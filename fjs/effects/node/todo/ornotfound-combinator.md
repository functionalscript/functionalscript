## `orNotFound` step adapter

**Priority:** P4
**Status:** open

### Problem

**The blocker this issue waited on has been met.** It was filed blocked on
"a second consumer of the ENOENT-is-benign policy appearing". `fjs/git`
now has about ten, all of one shape — `catchStep` over an effect with a
continuation that forgives one class of error and re-raises the rest:

```js
// fjs/git/refstore/module.f.mjs, tryWholeBytes
catchStep(readWholeBytes(path), e => isNotFound(e) ? pureOk(null) : pureError(e))
// fjs/git/refstore/module.f.mjs, isDirectoryAt
catchStep(mapStep(stat(path), s => s.isDirectory), e => leadsNowhere(e) ? pureOk(false) : pureError(e))
// fjs/git/packstore/module.f.mjs, namedIdx
catchStep(step(stat(path), …), c => leadsNowhere(c) ? pureOk(names) : pureError(c))
// fjs/git/repo/module.f.mjs, commonOf
catchStep(line, e => isNotFound(e) ? pureOk(repo) : pureError(e))
```

The forgiven class varies by site — `isNotFound`, `isNotFound ||
isDirectory`, `leadsNowhere`, `namesNothing` — so the predicate is a
parameter, not a fixed `ENOENT`. The proposal below predates `catchStep`
and is written against a `.step` method that no longer exists; the shape
it wants is now a **`catchStep` continuation factory**:

```ts
/** The continuation that answers `fallback` where `forgiven(e)` and re-raises otherwise. */
export const orElse: <E, T>(forgiven: (e: E) => boolean, fallback: T) => (e: E) => Effect<never, T, E>
```

so each site reads `catchStep(e, orElse(isNotFound, null))`. The original
text follows for the record of the policy it names.


`fileCas.list` (`fjs/cas/module.f.mjs:280-298`) spells out the three-way
`IoResult` policy inline: `ok → continue`, `ENOENT → benign default`,
`other error → throw`.

An earlier revision of this issue cited `read` as a second site, but `read`
fails the stream rather than applying this policy — `list` is the only live
site today. Per the second-consumer rule, implement this when
another site appears.

### Proposal

A **step adapter**: a continuation factory passed to `.step`, not a wrapper
taking the effect — the shape `step`
(`fjs/effects/module.f.mjs`) already uses for the two-way ok/error case. The
wrapper shape proposed earlier — `orNotFound(effect)(notFound)(onOk)` —
recreates the nesting problem the moment two policies chain
(`orNotFound(orNotFound(…)…)`); the adapter chains flat and leaves `Effect`
unextended. Add it beside `isNotFound` in `fjs/effects/node/module.f.mjs`:

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

- [ ] Add `orElse` beside `catchStep` in `fjs/effects/module.f.mjs`, with
      a proof of both branches.
- [ ] Rewrite `list` in `fjs/cas/module.f.mjs` and the `fjs/git` sites in
      `refstore`, `packstore`, `repo` and `store` on top of it.
- [ ] Cover all three branches (`ok`, `ENOENT`, non-`ENOENT` throw) in `fjs/effects/node/proof.f.mjs`.

### Related

- `step` (`fjs/effects/module.f.mjs`) — the short-circuit convention
  this
  follows; the two-way sibling of this three-way policy.
