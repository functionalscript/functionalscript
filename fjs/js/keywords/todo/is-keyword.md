## Export the keyword membership test once

**Priority:** P5
**Status:** open

### Problem

[`../module.f.mjs`](../module.f.mjs) exports `keywords` as a sorted array, so
each consumer that asks whether a name is a keyword builds its own set:
`const keywordSet = new Set(keywords)` is written in `fjs/js/tokenizer`,
`fjs/fsc/tokenizer` and `fjs/fsc/parser`. The three copies answer the same
question and can drift in how they ask it.

### Tasks

- [ ] Export the membership test once — an `isKeyword` predicate, or the set
      itself — and replace the three local `keywordSet` bindings with it.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [#2285](https://github.com/functionalscript/functionalscript/pull/2285) —
  derived `keywords` from its groups; this is what that change left.
