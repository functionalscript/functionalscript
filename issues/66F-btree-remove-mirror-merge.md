# 66F-btree-remove-mirror-merge. `btree/remove`: collapse the left/right mirror-image merge helpers (investigate)

**Priority:** P4
**Status:** open

## Problem

`fs/types/btree/remove/module.f.ts` defines two pairs of merge helpers that are
**left/right mirror images** of each other — identical control flow, with the
sibling tuple and the placement of the merged leaf swapped:

```ts
// fs/types/btree/remove/module.f.ts:31-42  (left)
const reduceValue0 = <T>(a: Branch<T>) => (n: Branch3<T>): Branch1<T> | Branch3<T> => {
    const [, v1, n2] = n
    if (a.length === 1) {
        switch (n2.length) {
            case 3: { return [[a[0], v1, ...n2]] }
            case 5: { return [[a[0], v1, n2[0]], n2[1], [n2[2], n2[3], n2[4]]] }
            default: { throw 'invalid node' }
        }
    } else {
        return [a, v1, n2]
    }
}

// fs/types/btree/remove/module.f.ts:44-55  (right — mirror of the above)
const reduceValue2 = <T>(a: Branch<T>) => (n: Branch3<T>): Branch1<T> | Branch3<T> => {
    const [n0, v1, ] = n
    if (a.length === 1) {
        switch (n0.length) {
            case 3: { return [[...n0, v1, a[0]]] }
            case 5: { return [[n0[0], n0[1], n0[2]], n0[3], [n0[4], v1, a[0]]] }
            default: { throw 'invalid node' }
        }
    } else {
        return [n0, v1, a]
    }
}
```

The same mirroring holds for `initValue0` (`:57-68`) vs `initValue1` (`:70-79`):
identical structure, with `a` placed left vs right and the sibling read from the
opposite end. The two pairs are already consumed symmetrically — `reduceX` is
fed `[reduceValue0, reduceValue2]` (`:98`) and `[initValue0, initValue1]`
(`:100`), and `reduceX` itself dispatches `case 0 → m0`, `case 2 → m2`.

So the module encodes "left vs right" **three times**: once in `reduceX`'s
`switch (i)`, and once in each mirror pair. Changing the rebalancing invariant
means editing both halves of each pair in lockstep — a maintenance hazard the
type checker cannot catch, since both halves type-check independently.

## Idea (investigate)

Parameterize each pair on a side descriptor instead of writing the mirror out by
hand. The two halves differ only in:

- which slot of `n` is the *value* neighbour vs the *sibling* (front vs back),
- whether the merged leaf `a` is prepended or appended.

A small `side`-indexed helper (or a tuple-reversal applied at the boundary)
could express the merge once and derive both directions, leaving `reduceX`'s
`[m0, m2]` array as the single place that names left vs right.

**Caveat — readability tradeoff.** Mirror-image code is a known case where naive
DRY can *hurt* clarity: a `reverse`-everything-conditionally helper can read
worse than two explicit, locally-readable blocks, which `AGENTS.md` warns
against (readability over deduplication). The deliverable of this issue is the
investigation: prototype the parameterized form and keep it **only if** it is at
least as readable as the current four functions. If not, close as won't-fix and
record the decision (the duplication is the accepted cost of readability).

## Tasks

- [ ] Prototype a side-parameterized merge that derives `reduceValue0`/`2` from
      one definition; do the same for `initValue0`/`1`.
- [ ] Compare readability against the current explicit pairs.
- [ ] Keep only if clearer; otherwise close won't-fix with the rationale
      recorded in the module's `README.md` / JSDoc.

## Related

- [i193-btree-path-fold-engine](./193-btree-path-fold-engine.md) — shares the
  cross-module `fold`/`reduceX` Path-walk engine between `set` and `remove`;
  this issue is the orthogonal, *within-`remove*` left/right mirror collapse.
