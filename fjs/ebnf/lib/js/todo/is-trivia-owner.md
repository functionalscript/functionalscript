## `isTrivia` is copied outside the grammar that defines trivia

**Priority:** P5
**Status:** open

### Problem

Which token kinds are trivia — `ws`, `nl`, `//`, `/*` — is a fact of the
JavaScript token grammar in [this module](../module.f.mjs), which already
exports `mergeTrivia` "stated once, here, so that every reader of the
grammar folds by the same rule". The membership test is not exported, and
its readers wrote it:

- `isTrivia` in [`fjs/compiler/tokenizer`](../../../../compiler/tokenizer/module.f.mjs),
  over a kind;
- `isTrivia` in [`fjs/website/demo/highlight`](../../../../website/demo/highlight/module.f.mjs),
  the same body over `{ kind }`.

[083-compiler-hash-comments](../../../../compiler/todo/083-compiler-hash-comments.md)
would add a comment kind; every copy would then have to change together,
and nothing says so at either.

### Proposal

Export `isTrivia(kind)` beside `mergeTrivia`; the readers import it.

### Tasks

- [ ] Export, prove, and replace the copies.
