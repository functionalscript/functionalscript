## `nameText` is `refstore/name`'s `nameKey`

**Priority:** P5
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs) reads a tree entry's name and mode as
text through a private `nameText = name => codePointListToString(toArray(name))`.
[`fjs/git/refstore/name`](../../../git/refstore/name/module.f.mjs) exports
the same function, to the character, as `nameKey`: one code unit per byte,
for a Git name. Two names for one conversion, in two modules that both
speak Git names.

### Proposal

`cas/git` imports `nameKey`, or, if the byte-to-string conversion deserves
a neutral owner, `fjs/text/utf16` exports it and both import that. Either
way `nameText` goes.

### Tasks

- [ ] One owner; `cas/git` imports it.
