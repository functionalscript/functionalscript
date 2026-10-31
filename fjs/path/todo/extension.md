## `extension` is path work inlined in the media detector

**Priority:** P4
**Status:** open

### Problem

`detectPath` in [`fjs/media/type`](../../media/type/module.f.mjs) carries its
own path manipulation:

```js
// extension
const name = basename(path)
const dot = name.lastIndexOf('.')
return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
```

including the rule that `.gitignore` has no extension.
[DESIGN.md §4](../../../doc/DESIGN.md#4-reuse-dry-and-separation-of-concerns) names this
case: path manipulation belongs in `fjs/path`, not inline in a loader, even
with a single consumer. [`fjs/path`](../module.f.mjs) has `basename`, `parent`,
`ancestors` and `relativize` but no `extension` or `stem`, and
`fjs/website`'s `versionOf` and `fjs/dev`'s `isAuthored` do adjacent suffix
work by hand.

### Proposal

`fjs/path` exports `extension`, and a `stem` if the website wants it;
`media/type` keeps only its table and the `charset` rule.

### Tasks

- [ ] Export `extension` from `fjs/path`, with the leading-dot rule and its
      proof; import it in `media/type`.
- [ ] Look at `versionOf` and `isAuthored` for a `stem`.
