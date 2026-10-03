## import-root-split. `path/import` re-derives the root `fjs/path` already splits, and the two disagree on `//`

**Priority:** P3
**Status:** open

### Problem

[`fjs/path`](../module.f.mjs) reads a path as a root and a rest through
its private `split`, `isRooted` and `rejoin`, and its doc on `split` is
careful about one case: `//` is a UNC root that stops at the two
slashes, so that `..` cannot fold into `server/share`.
[`fjs/path/import`](../import/module.f.mjs)'s `decode` does not use any
of that. It splits and rejoins on its own:

```js
// import decode
const rooted = specifier.startsWith('/')
const components = toArray(fold(importDotSegments(rooted))([])(rooted ? raw.slice(1) : raw))
…
return … ? `${rooted ? '/' : ''}${segments.join('/')}` : null
```

Only `_dotSegmentFold` is shared; the root rule is a second copy, and a
simpler one. The two disagree where the doc on `split` says it matters:
at `ef756f0`, `decode('//x')` is `'//x'`, because `decode` keeps the
empty component on purpose (so that `..` cancels it, not the segment
before), and `resolve` then hands that to `pathConcat`, which reads `//x`
as a UNC root. A specifier that was a relative-looking URL path with an
empty first segment comes out as a different root, which is the outcome
`decode`'s colon refusal exists to prevent, and in URL terms `//x/y` is a
network-path reference, not a path at all. Nothing in
[`proof.f.mjs`](../import/proof.f.mjs) exercises a leading `//`.

### Proposal

`fjs/path` exports one root-aware fold-and-rejoin, parameterised by the
segment classifier and the segment decoder, so that `import` supplies
only `importSegmentKind` and `importSegment` and inherits the root rule,
`//` included. Whether a leading `//` is then refused outright or read as
`path` reads it is the decision to make in the `todo/` before the code;
refusing is the conservative answer and matches the colon rule.

### Tasks

- [ ] Decide what a leading `//` specifier means; pin it in
      `import`'s proof first.
- [ ] The shared fold-and-rejoin in `fjs/path`; `decode` through it.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [posix-backslash-names](./posix-backslash-names.md) — the other place
  the two modules' character rules meet.
