## A folded-away prefix can root a relative specifier

**Priority:** P3
**Status:** open

### Problem

[`fjs/path/import`](../module.f.mjs)'s `decode` turns some relative
specifiers into rooted paths. At `c40966b`:

- `decode('.//x')` is `/x`
- `decode('a/..//x')` is `/x`
- `decode('a/..///x')` is `//x`
- `resolve('/r/m.f.js')('.//x')` is `/x`

The first three are relative as written. The first two come out with the
POSIX root and the third with the UNC root, so `resolve` stops reading them
against the importer's directory. In the fourth, a file in `/r/` that
imports `.//x` gets `/x` instead of `/r/x`.

`importSegmentKind` keeps empty components on purpose, so that in
`bad%//../dep` the `..` cancels the empty component and not `bad%`.
`fjs/path`'s `_foldRejoin` folds the specifier, and in these inputs the `.`,
or the `a/..` pair, folds away and leaves an empty component first. Joining
the surviving segments with `/` then writes that component as a leading
separator: the empty component plus `x` becomes `/x`, and two of them plus
`x` become `//x`. The root was read before folding, from text that had none,
so nothing checks the root of the result.

This is the outcome `decode`'s colon and `//` refusals exist to prevent: a
specifier that silently names a path under a different root.

### Proposal

Refuse it ([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
`decode` returns `null` when a relative specifier folds to segments whose
first one is empty, so its decoded form would start with a separator. Dropping
the empty component instead would answer a path the URL does not spell, and
keeping it is what roots the path.

### Tasks

- [ ] Pin the four inputs above as refusals in `import`'s proof, and keep
      `./x//y` and `bad%//../dep` as they are today.
- [ ] Refuse in `decode`, or in `_foldRejoin` for every spelling whose
      classifier keeps an empty segment, and say which in the JSDoc.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [import-specifier-kind](./import-specifier-kind.md) explains why a
  specifier's kind should come from one classifier. This issue is a case
  where the kind changes after folding.
