## `orElse`: one continuation for "forgive this error, re-raise the rest"

**Priority:** P4
**Status:** open

### Problem

This issue was filed as `orNotFound`, blocked on a second consumer of the
ENOENT-is-benign policy, with `fileCas.list` in `fjs/cas/module.f.mjs` as
the only site. The blocker has been met many times over: `fjs/git` now has
about ten sites, all of one shape — `catchStep` over an effect with a
continuation that forgives one class of error and re-raises every other:

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

Two things changed since the issue was written. The forgiven class varies
by site — `isNotFound`, `isNotFound || isDirectory`, `leadsNowhere`,
`namesNothing` — so the predicate is a parameter, not a fixed `ENOENT`,
and the name `orNotFound` is too narrow. And the effect API moved from a
`.step` method over `IoResult` to `catchStep`, which already separates the
ok path from the error path, so the adapter no longer needs an `onOk`
branch at all: it is the error continuation and nothing else.

### Proposal

A continuation factory for `catchStep`, beside `catchStep` in
`fjs/effects/module.f.mjs` since nothing in it is Node-specific:

```ts
/** The `catchStep` continuation that answers `fallback` where `forgiven(e)`, and re-raises `e` otherwise. */
export const orElse: <E, T>(forgiven: (e: E) => boolean, fallback: T) => (e: E) => Effect<never, T, E>
```

Each site then reads `catchStep(e, orElse(isNotFound, null))`. It is a
continuation rather than a wrapper taking the effect for the reason the
original issue gave: a wrapper nests the moment two policies chain, where
a continuation chains flat and leaves `Effect` unextended.

`fileCas.list`, the site this issue was filed for, is **not** a consumer
after all: `access` answers its `IoResult` as the effect's *success*
payload, with `NotImplemented` alone on the error channel, so `list`
inspects the result with `resultStep` and `catchStep` never sees the
`ENOENT`. It keeps its `resultStep` form. A result-level twin of `orElse`
is not proposed here: `list` is the only such site, and the
second-consumer rule that held this issue applies to it in turn.

### Tasks

- [ ] Add `orElse` beside `catchStep` in `fjs/effects/module.f.mjs`, with
      a proof of both branches — forgiven answers the fallback, anything
      else is re-raised unchanged.
- [ ] Rewrite the `fjs/git` sites in `refstore`, `packstore`, `repo` and
      `store` on top of it; their proofs pass unchanged. `fileCas.list`
      is untouched.
- [ ] `tsc`, `fjs test`.

### Related

- `catchStep` (`fjs/effects/module.f.mjs`) — the error-path step this
  continuation is written for; `step` is its ok-path sibling.
