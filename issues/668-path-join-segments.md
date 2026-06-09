# 668-path-join-segments. `fs/path`: own segment joining instead of inline `` `${a}/${b}` ``

**Priority:** P4
**Status:** done

## Problem

Joining a directory to a child name is a path concern, but four modules do
it by hand with raw string interpolation instead of going through
`fs/path`. AGENTS.md names exactly this case under *Separation of concerns*:
"path manipulation belongs in `fs/path`, not inline in a loader."

Inline joins today:

```ts
// fs/cas/module.f.ts:39   — shard a base32 key into a relative CAS path
return `${prefix}/${a}/${b}/${c}`
// fs/cas/module.f.ts:52   — directory of the target file under the store root
const dir = `${path}/${parts.slice(0, -1).join('/')}`
// fs/cas/module.f.ts:55   — the target file under the store root
.step(() => writeFile(`${path}/${p}`, value))
// fs/dev/module.f.ts:60   — child entry during a recursive readdir walk (a loader)
const file = `${p}/${name}`
// fs/effects/node/virtual/module.f.ts:132 — child entry during a recursive virtual readdir
result = [...result, ...f(`${parentPath}/${name}`, content as Dir)]
```

Five sites, four modules — well past the "second consumer" bar. The
operation is one concept ("append a segment to a path with a `/`
separator") repeated as ad-hoc string formatting. If the separator
convention ever has to change (e.g. to normalize away a trailing slash on
`p`, or to special-case an empty base so the result isn't `/name`), every
site has to be found and edited by hand.

## Why the existing `fs/path.concat` does **not** fit

`fs/path` already exports `concat` (`fs/path/module.f.ts:55`) and
`normalize` (`:46`), but both run the input through `parse`
(`:38`), and `parse`'s `foldNormalizeOp` drops every empty segment via
`case '': … return state` (`:14`). For a `/`-separated split that means
the **leading empty segment of an absolute path is discarded**:

```ts
normalize('/abs/root/x')  // → 'abs/root/x'  (leading '/' lost)
concat('/abs/root')('x')  // → 'abs/root/x'  (same)
```

The CAS store root (`path` in `fileKvStore`, `fs/cas/module.f.ts:45,52,55`)
can be an absolute path, and the virtual-FS walk
(`fs/effects/node/virtual/module.f.ts:123-138`) must preserve names
verbatim. So these sites legitimately can **not** call `concat` — it would
corrupt absolute roots and collapse `.`/`..` that callers may want left
alone. That is precisely why each one hand-rolls the join. The missing
piece is a *non-normalizing* segment join in `fs/path`.

## Proposal

Add a plain, normalization-free `join` to `fs/path` and route the five
sites through it:

```ts
// fs/path/module.f.ts
/**
 * Joins two path fragments with a single POSIX `/` separator, without
 * normalization. Unlike {@link concat}, the result is not parsed/collapsed,
 * so absolute roots and `.`/`..` segments are preserved verbatim. Use this
 * for building paths from already-clean segments (directory walks, store
 * layouts); use {@link concat} when normalization is desired.
 */
export const join: Reduce<string> = a => b => `${a}/${b}`
```

Then:

```ts
// fs/dev/module.f.ts
const file = join(p)(name)
// fs/effects/node/virtual/module.f.ts
result = [...result, ...f(join(parentPath)(name), content as Dir)]
// fs/cas/module.f.ts
return join(prefix)(join(a)(join(b)(c)))      // or a small variadic helper
```

Decide the surface during implementation:

- A curried binary `join` (above) matches `Reduce<string>` and the codebase's
  one-arg-at-a-time style.
- If the 3-segment CAS path reads awkwardly as nested `join`, a variadic
  `joinAll = (...segments: readonly string[]) => string` (folding `join`)
  is the natural companion — but only add it if the binary form is genuinely
  unreadable at the call site, not preemptively.

This is a small, behaviour-preserving change: each `join(a)(b)` produces the
exact same string the inline `` `${a}/${b}` `` produces today, so no path
output changes. The win is locating the convention in one place and making
the loaders read in terms of `fs/path` instead of string formatting.

## Tasks

- [ ] Add `join` (and document the `join` vs `concat` distinction) to
      `fs/path/module.f.ts`, with proof coverage in `fs/path/proof.f.ts`.
- [ ] Replace the five inline joins in `cas`, `dev`, and
      `effects/node/virtual` with `join`.
- [ ] Confirm `npx tsc` and `npm test` pass; check the `cas` and
      `effects/node/virtual` proofs still produce identical paths.

## Caveats / why this is a proposal, not a mechanical edit

- **`cas` line 52 also slices.** `${path}/${parts.slice(0, -1).join('/')}`
  joins the store root to the *parent directory* of the target. The
  `parts.slice(0, -1).join('/')` part is a separate "drop the last segment"
  operation over already-parsed segments; `join` only replaces the outer
  `` `${path}/…` ``. Don't try to fold the slice into `join`.
- **Don't reuse `parse`/`normalize` here.** As shown above they strip
  leading `/` and collapse `.`/`..`; the whole point of `join` is to *not*
  do that. Keep the two functions distinct and say so in the JSDoc.
- **Scope.** This is strictly the segment-join concern. The recursive
  directory-walk duplication between `dev/allFiles` and the virtual-FS
  `readdir` is a separate (and weaker — they traverse different data
  sources) question; do not couple it to this change.

## Related

- AGENTS.md, *Separation of concerns* — cites "path manipulation belongs in
  `fs/path`, not inline in a loader" as the canonical example; this is that
  example in the live codebase.
- [i011-fs-load](./011-fs-load.md) — module loading, a consumer of path
  manipulation.
