## dir-spine-descend. Share the immutable `Dir`-spine descent

**Priority:** P4
**Status:** open

### Problem

Three helpers in `fjs/effects/node/virtual/module.f.ts` independently
implement "recurse down `path` segments through the `Dir` tree, bail when an
intermediate node isn't a directory, then rebuild the immutable spine with a
spread":

- `operation`'s inner `f` — `:62-74`
- `extractEntity` — `:188-193`
- `insertEntityAt` — `:220-226`

```ts
// operation.f
const [first, ...rest] = path
const subDir = dir[first]
if (typeof subDir !== 'object' || Array.isArray(subDir)) { return op(dir, path) }
const [newSubDir, r] = f(subDir as Dir, rest)
return [{ ...dir, [first]: newSubDir }, r]

// extractEntity / insertEntityAt: same spine, different guard set and
// short-circuit policy, plus `if (result[0] === 'error') { return [dir, result] }`
```

All three split head/rest, look up the sub-dir, guard "not a directory",
recurse, and rebuild via `{ ...dir, [first]: newSub }` — each with its own
`as Dir` cast. Only the leaf action (apply `op` / remove entry / insert
entity) and the intermediate-miss policy differ.

### Proposal

A private `descend` combinator parameterized by the leaf and the
"path not navigable" fallback:

```ts
const descend = <T>(
    leaf: (dir: Dir, path: readonly string[]) => readonly [Dir, T],
    onMiss: (dir: Dir, path: readonly string[]) => readonly [Dir, T],
) => {
    const go = (dir: Dir, path: readonly string[]): readonly [Dir, T] => {
        if (path.length <= 1) { return leaf(dir, path) }
        const [first, ...rest] = path
        const sub = dir[first]
        if (typeof sub !== 'object' || Array.isArray(sub)) { return onMiss(dir, path) }
        const [newSub, r] = go(sub, rest)
        return [{ ...dir, [first]: newSub }, r]
    }
    return go
}
```

`operation`, `extractEntity`, and `insertEntityAt` each supply their
leaf/miss functions. Known deltas the spike must reconcile before
committing to the shape:

- `operation` applies `op(dir, path)` at the failed node (not an error
  short-circuit) and also at `path.length === 0`; extract/insert
  short-circuit `enoent`/`'not a directory'` and reject the root case.
- extract/insert propagate a leaf `error` *without* rebuilding the spine
  (`return [dir, result]`), while `operation` always rebuilds; the
  combinator must preserve the discard-on-error behavior (or the spike must
  show rebuilding an unchanged subtree is observably identical — it isn't
  for object identity, but `State` equality is structural in proofs).
- extract/insert guard `undefined`/`Array`/`function`; `operation` guards
  `typeof !== 'object' || Array`. Unify or parameterize.

If the three don't collapse without contortion, scope down to sharing
between `extractEntity` and `insertEntityAt` only (their spines are
identical including the error-propagation policy) and leave `operation`
as-is.

### Tasks

- [ ] Spike the combinator across all three; fall back to
      extract/insert-only sharing if `operation` doesn't fit cleanly.
- [ ] `npx tsc`, `fjs t`; rename/rm/mkdir proofs pass unchanged.

### Related

- [resolve-file-helper](./resolve-file-helper.md) — leaf-level counterpart.
- [name-entity-kind-discrimination-once](./name-entity-kind-discrimination-once.md)
  — the guards above should use those predicates once extracted.
