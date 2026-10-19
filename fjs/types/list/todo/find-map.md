## "First non-null answer" is folded by hand at each site

**Priority:** P4
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs) has `find`, `filterMap` and `first`, and
not their composition, so every refusal walk in `fjs/media` writes it:
`firstReasonOf` in [`nix`](../../../media/nix/module.f.mjs) as a `reduce`
with `??`; `pageRefusal` in [`html`](../../../media/html/module.f.mjs) as the
same `reduce` inline; `refusedLeaf` in [`media`](../../../media/module.f.mjs)
as `find(null)` over `map`; `firstInvalid` in
[`revision`](../../../media/revision/module.f.mjs) as `find(null)` over a
predicate.

```js
// nix
const firstReasonOf = f => items => items.reduce((reason, item, index) => reason ?? f(item, index), null)
// media
find(null)(p => p !== null)(map(([k, x]) => walk([...path, k])(x))(children))
```

### Proposal

`findMap = f => compose(filterMap(f))(first(null))` in `fjs/types/list`:
`filterMap` drops the `null`s lazily, so it stops at the first answer.
`media` and `revision` already walk lazy lists and use it.

`nix` and `html` are recursive walks over arrays, one frame per level of
nesting, and `firstReasonOf`'s doc says its `reduce` is a plain one on
purpose: every frame a level costs is depth a legal expression loses before
the stack runs out. Routing each level through the lazy list's `next` would
spend frames there. So those two take an eager `findMap` over arrays, in
[`fjs/types/array`](../../array/module.f.mjs), which is `firstReasonOf`'s
`reduce` under the shared name, with `nix`'s depth sentence as its doc; the
`index` its callback takes is what `nix` reads.

### Tasks

- [ ] `findMap` in `fjs/types/list` with proof; `media` and `revision` import
      it.
- [ ] The eager `findMap` in `fjs/types/array` with proof; `nix` and `html`
      import it.

### Related

- [simplify-list-type](./simplify-list-type.md) — the list type these
  combinators sit on.
