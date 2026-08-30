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
its root is non-empty" (`r !== ''`) at three sites: `:101`, `:140`, and
`:184`. `escapes` (`:160`) is not a fourth — it passes a literal `false`,
deliberately declining the test, because an escape check treats even a
rooted path's `..` as escaping. The module's own docs leave root detection
open (UNC `server/share`, drive-relative `C:foo`), so a change there
currently has to be threaded through each entry point rather than through
one decode.

### Proposal

Three private one-liners:

```js
/** The canonical decode every entry point starts from. */
const parts = p => split(toPosix(p))
/** Whether a decoded path is rooted: exactly when its root half is non-empty. */
const isRooted = ([r]) => r !== ''
/** The segments of a decoded path. */
const segmentsOf = p => posixSegments(isRooted(p))(p[1])
```

The rootedness test appears at **exactly three** sites today, and `isRooted`
has to cover all three or the "one owner" claim is not true:

| site | today | reads as |
|---|---|---|
| `rejoin` (`../module.f.mjs:101`) | `posixSegments(r !== '')` | via `segmentsOf` |
| `parse` (`:140`) | `posixSegments(r !== '')` | via `segmentsOf` |
| `concat` (`:184`) | `if (rb !== '')` | `if (isRooted(pb))` |

`rejoin` matters most among them — `normalize` and `concat` reach the folding
rule only by delegating to it, so leaving its own `r !== ''` would let every
entry point be rewritten while the duplication survives in the function they
all call. `concat`'s test is the one that needs `isRooted` **directly**: the
other two reach the predicate through `segmentsOf`, but `concat` asks it for
a different decision — does an absolute `b` replace `a` — and so is
reachable through neither `parts` nor `segmentsOf`.

That table is the whole set: the only other `!== ''` in the module is
`base !== ''` at `:212`, which tests a served-prefix argument rather than a
decoded root. After the rewrite, `root`, `parse`, `normalize`, and `concat`
are single expressions over `parts`/`segmentsOf`/`rejoin`, the rootedness
rule has one definition, and `escapes` keeps its explicit `false` as the
visibly odd one out. No behavior change.

### Tasks

- [ ] Add `parts`/`isRooted`/`segmentsOf`; rewrite all three rows of the
      table above, and the entry points through `parts`.
- [ ] Check the result: `r !== ''` on a decoded root appears nowhere outside
      `isRooted`.
- [ ] `tsc`, `fjs t`; the path proofs pass unchanged.
