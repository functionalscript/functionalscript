## One private decode for the path entry points

**Priority:** P5
**Status:** open

### Problem

Every entry point re-derives the same two-step decode — POSIX-ify, then
split off the root — and the rootedness rule is re-stated beside it:

```js
// ../module.f.mjs
124: export const root = path => split(toPosix(path))[0]
139:     const [r, rest] = split(toPosix(path))
140:     return posixSegments(r !== '')(rest)
160: export const escapes = path => posixSegments(false)(split(toPosix(path))[1]).includes('..')
169: export const normalize = path => rejoin(split(toPosix(path)))
183:     const [rb, restb] = split(toPosix(b))
```

`split(toPosix(p))` appears five times, and "a path is rooted exactly when
its root is non-empty" (`r !== ''`) three times (`:101`, `:140`, with
`escapes` at `:160` passing a deliberate `false` — the one documented
exception, since an escape check treats even a rooted path's `..` as
escaping). The module's own docs leave root detection open (UNC
`server/share`, drive-relative `C:foo`), so a change there currently has to
be threaded through each entry point rather than through one decode.

### Proposal

Two private one-liners:

```js
/** The canonical decode every entry point starts from. */
const parts = p => split(toPosix(p))
/** The segments of a decoded path; rooted iff the root is non-empty. */
const segmentsOf = ([r, rest]) => posixSegments(r !== '')(rest)
```

`rejoin` (`../module.f.mjs:101`) is rewritten through `segmentsOf` **too**,
and it is the one that matters most: `normalize` and `concat` reach the
rootedness rule only by delegating to it, so leaving its own `r !== ''` in
place would let every listed entry point be rewritten while the duplication
this issue removes survives in the function they all call.

After that, `root`, `parse`, `normalize`, and `concat` are single expressions
over `parts`/`segmentsOf`/`rejoin`, `rejoin` states the rootedness rule once
for all of them, and `escapes` keeps its explicit `false` as the visibly odd
one out. No behavior change; the decode and the rootedness rule each get one
owner.

### Tasks

- [ ] Add `parts`/`segmentsOf`; rewrite `rejoin` through `segmentsOf` and the
      entry points through `parts`.
- [ ] `npx tsc`, `fjs t`; the path proofs pass unchanged.
