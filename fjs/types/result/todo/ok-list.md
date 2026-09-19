## ok-list. "The list, or its first error" has six private owners

**Priority:** P3
**Status:** open

### Problem

Collapsing a list of `Result`s into a `Result` of the list, first error
winning, is written six times, in five shapes, and `fjs/types/result` —
which owns `ok`, `error`, `unwrap`, `invert`, `mapOk` and `okThen` — does
not export it:

```js
// fjs/effects/common/module.f.mjs, okList — private, with the doc the rest lack
const okList = list => {
    for (const r of list) { if (r[0] === 'error') { return r } }
    return resultOk(list.map(unwrap))
}
// fjs/fsc/serializer/module.f.mjs, every — four type casts to say the same
const every = xs => {
    const bad = xs.find(x => x[0] === 'error')
    return bad === undefined ? ok(xs.map(x => x[1])) : error(bad[1])
}
// fjs/media/json/parser/module.f.mjs, all
const all = results => {
    const errors = results.flatMap(r => r[0] === 'error' ? [r] : [])
    return errors.length === 0 ? ok(results.map(unwrap)) : errors[0]
}
// fjs/fsc/module.f.mjs, append / collect / none / all — a fold into a List
const collect = (acc, item) => okThen(list => mapOk(append(list))(item))(acc)
const all = items => items.reduce(collect, none)
// fjs/fsc/ast/module.f.mjs, appended / collect / noValues / noMembers — the same fold again
const collect = item => okThen(list => mapOk(appended(list))(item))
// fjs/edag/rust/module.f.mjs, allOk — a right fold through map2, undefined on an empty list
const allOk = results => results.length === 1
    ? mapOk(x => [x])(results[0])
    : map2((xs, x) => [...xs, x])(allOk(results.slice(0, -1)), results[results.length - 1])
```

All six agree on the contract — the first error in list order, the later
ones discarded — and `effects/common`'s doc says why that contract is the
right one ("a chain has one error channel"). Every site finishes with an
array, so the two `List`-building folds gain nothing from the `List`.

### Proposal

One export from `fjs/types/result/module.f.mjs`, with `okList`'s existing
doc paragraph as its contract:

```ts
/** The values of every result, or the first error among them, in list order. */
export const okList: <T, E>(list: readonly Result<T, E>[]) => Result<readonly T[], E>
```

Then `effects/common` imports it instead of defining it; `fsc/serializer`'s
`every` and `json/parser`'s `all` become the import; `fsc/module.f.mjs`
drops `append`/`collect`/`none`/`all` and its `jsonValue` reads
`mapOk(arrayWrap)(okList(value.map(jsonValue)))`; `fsc/ast`'s `toDjs` drops
`collect`/`appended`/`noValues`/`noMembers` for the same call; `edag/rust`'s
`allOk` goes too — its callers guard the empty list before calling it, and
`okList([])` is `ok([])`, so nothing changes for them and the recursion
that never terminates on `[]` is gone. The name is
`okList` because that is what the one documented copy is called; a
`List`-returning variant is not added until a site wants one.

### Tasks

- [ ] `okList` in `fjs/types/result` with a proof: empty list, all ok,
      first of two errors wins.
- [ ] Rewrite the six sites; proofs pass unchanged.
- [ ] `tsc`, `fjs test`.

[`fjs/media/nix/todo/serializer-validation-split.md`](../../../media/nix/todo/serializer-validation-split.md)
rules out a `traverse` helper for *its* copies, which are over `undefined`
and vanish once its serializer is total. That decision stands: none of the
six sites here goes away by a split — each genuinely collects the results
of a fallible walk — and `okList` is the `Result` chain's combinator, not a
`Nullable` array's.

### Related

- [`../../../effects/todo/allvoid-combinator.md`](../../../effects/todo/allvoid-combinator.md) —
  builds `allOk` on `effects/common`'s `okList`; after this it builds on the
  shared one.
- [`../../../fsc/todo/157-json-djs-shared-value-machine.md`](../../../fsc/todo/157-json-djs-shared-value-machine.md) —
  the value walkers above two of these sites; this issue is the result
  plumbing under them, which that issue does not mention.
