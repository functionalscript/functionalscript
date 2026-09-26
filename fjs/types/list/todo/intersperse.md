## intersperse. Separators are interleaved by hand at four sites, and adjacent runs merged at two

**Priority:** P5
**Status:** open

### Problem

`fjs/types/list` has `flatMap`, `scan` and `fold` but no `intersperse`,
so every renderer that puts a separator between items writes the index
test itself:

```js
// fjs/website/page, the breadcrumb
return at === 0 ? [link] : [' / ', link]
// fjs/website/changelog, neighbours
...links.flatMap((link, i) => i === 0 ? [link] : [' · ', link])
// fjs/website/changelog, _group
(link, i) => i === 0 ? [link] : [['text', ', '], link]
// fjs/media/nix, the list serializer
definedItems.flatMap((item, index) => index === 0 ? [item] : [' ', item])
```

The changelog's `_merged`, which coalesces adjacent `text` spans, and
`coalesceStrings` in `fjs/media/nix` are the same reduce-over-last
shape for a second missing operation.

### Proposal

```ts
export const intersperse: <S>(sep: S) => <T>(list: List<T>) => List<T | S>
export const mergeAdjacent: <T>(join: (a: T, b: T) => Nullable<T>) => (list: List<T>) => List<T>
```

here, and the six sites through them.

### Tasks

- [ ] The two operations with proofs; the sites through them.
- [ ] `tsc`, `fjs test`.

### Related

- [../../../media/nix/todo/serializer-validation-split.md](../../../media/nix/todo/serializer-validation-split.md)
  — nix's `joinChunks`; the nix call sites may follow that issue instead.
