## One predicate for an `ioError`'s code

**Priority:** P4
**Status:** open

### Problem

"This channel error carries code X" is spelled at every site that asks it.
[`node`](../node/module.f.mjs) exports four such predicates, two by
destructuring and two by index:

```js
export const isNotFound = ([tag, payload]) => tag === 'ioError' && payload.code === 'ENOENT'
export const leadsNowhere = e => isNotFound(e) || (e[0] === 'ioError' && e[1].code === 'ELOOP')
export const namesNothing = e => leadsNowhere(e) || (e[0] === 'ioError' && e[1].code === 'ENOTDIR')
export const isDirectory = ([tag, payload]) => tag === 'ioError' && payload.code === 'EISDIR'
```

and `madeHere` in [`fjs/git/refstore/write`](../../git/refstore/write/module.f.mjs)
writes a fifth inline, `orElse(e => e[0] === 'ioError' && e[1].code ===
'EEXIST', false)`. The vocabulary, `ioError` and `IoChannel`, is this
directory's [`module.f.mjs`](../module.f.mjs), not `node`'s, so the
predicate's maker belongs here.

Two callers also re-derive `orElse` itself, which exists so that a caller
does not write the ternary: `configAt` in [`fjs/cas/git`](../../cas/git/module.f.mjs)
has `catchStep(readUtf8File(path), e => isNotFound(e) ? pureOk('') :
pureError(e))`, and `exists` in `node` has the three-way `resultStep` over
`access`, while `absent` a few lines below it in `cas/git` shows the
intended form, `catchStep(mapStep(stat(path), () => false),
orElse(namesNothing, true))`.

### Proposal

`hasCode = code => e => e[0] === 'ioError' && e[1].code === code` beside
`ioError` in `module.f.mjs`. `node`'s four predicates become one line each
over it, `madeHere` names its code, and the two hand-written `orElse`s
become `catchStep(readUtf8File(path), orElse(isNotFound, ''))` and
`catchStep(mapStep(access(path), () => true), orElse(namesNothing, false))`.

### Tasks

- [ ] `hasCode` with a proof.
- [ ] The five predicates over it.
- [ ] `configAt` and `exists` over `orElse`.
- [ ] `tsc` and the suites under `fjs/effects`, `fjs/git/refstore` and
      `fjs/cas/git`.

### Related

- [compensate-step](./compensate-step.md) — the other error-branch
  combinator the same modules re-derive.
