## Case-insensitive comparisons that fold beyond ASCII

**Priority:** P4
**Status:** open

### Problem

[`asciiLowercase`](../module.f.js) is the "ASCII lowercase" an ASCII
case-insensitive comparison asks: `A` to `Z` lowercased and nothing else.
`fjs/media/html` compares through it. Other modules still compare names a
format defines as ASCII case-insensitive through `toLowerCase()`, which folds
beyond ASCII — `'K'`, the Kelvin sign, lowercases to `k` — so a name the
format's own reader refuses or keeps apart is taken for another:

- [`fjs/git/config`](../../../git/config/module.f.js) — section names, the
  size suffix and prefixes, and boolean words. Git lowercases with the C
  locale's `tolower`, ASCII only.
- [`fjs/web`](../../../web/module.f.mjs) — the authority's host and the
  scheme, both ASCII case-insensitive in RFC 3986.
- [`fjs/media/type`](../../../media/type/module.f.mjs) — a path's extension.
- [`fjs/media/mermaid`](../../../media/mermaid/module.f.js) — the `<br` tag.

`fjs/media/rust` and `fjs/media/markdown` ask `toLowerCase()` about case
itself, not to compare a name, and are not on the list.

### Proposal

Each site above compares through `asciiLowercase`, with a proof case where a
non-ASCII fold would have matched.

### Tasks

- [ ] `fjs/git/config`.
- [ ] `fjs/web`.
- [x] `fjs/effects/node` and its virtual host.
- [ ] `fjs/media/type` and `fjs/media/mermaid`.

### Related

- [lexical-predicates-from-text-ascii](../../../js/identifier/todo/lexical-predicates-from-text-ascii.md)
  — the same Kelvin-sign hole, in the character classes.
