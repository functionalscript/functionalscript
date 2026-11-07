## Case-insensitive comparisons that fold beyond ASCII

**Priority:** P4
**Status:** open

### Problem

[`asciiLowercase`](../module.f.js) is the "ASCII lowercase" an ASCII
case-insensitive comparison asks: `A` to `Z` lowercased and nothing else.
`fjs/media/html` and `fjs/git/config` compare through it. Other modules still compare names a
format defines as ASCII case-insensitive through `toLowerCase()`, which folds
beyond ASCII — `'K'`, the Kelvin sign, lowercases to `k` — so a name the
format's own reader refuses or keeps apart is taken for another:

- [`fjs/web`](../../../web/module.f.mjs) — the authority's host and the
  scheme, both ASCII case-insensitive in RFC 3986.
- [`fjs/effects/node`](../../../effects/node/module.f.mjs) — header names,
  which HTTP compares ASCII case-insensitively;
  [`fjs/effects/node/virtual`](../../../effects/node/virtual/module.f.mjs)'s
  listen address too.
- [`fjs/media/type`](../../../media/type/module.f.mjs) — a path's extension.
- [`fjs/media/mermaid`](../../../media/mermaid/module.f.js) — the `<br` tag.

`fjs/media/rust` and `fjs/media/markdown` ask `toLowerCase()` about case
itself, not to compare a name, and are not on the list.

### Proposal

Each site above compares through `asciiLowercase`, with a proof case where a
non-ASCII fold would have matched.

### Tasks

- [x] `fjs/git/config`.
- [ ] `fjs/web`.
- [ ] `fjs/effects/node` and its virtual host.
- [ ] `fjs/media/type` and `fjs/media/mermaid`.

### Related

- [lexical-predicates-from-text-ascii](../../../js/identifier/todo/lexical-predicates-from-text-ascii.md)
  — the same Kelvin-sign hole, in the character classes.
