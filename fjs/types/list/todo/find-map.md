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
`filterMap` drops the `null`s lazily, so it stops at the first answer. The
sites above use it; `nix`'s indexed form is `findMap` over the indexed items.

### Tasks

- [ ] `findMap` with proof; `nix`, `html`, `media` and `revision` import it.

### Related

- [simplify-list-type](./simplify-list-type.md) — the list type these
  combinators sit on.
