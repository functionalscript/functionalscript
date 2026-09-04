## Refuse malformed UTF-16 in the string-taking terminal helpers

**Priority:** P2
**Status:** open

### Problem

`set` and `range` read their argument with `stringToCodePointList`, which does
not throw on malformed UTF-16: it tags an unpaired surrogate with `errorMask`
and yields it as a negative number. Nothing checks for the tag, so the number
is encoded as an ordinary symbol:

```js
set('\uD800')()   // ['set', -2147428352, -2147428351]
```

An ordinary symbol is a non-negative safe integer
([ebnf-range-set](../../bnf/todo/ebnf-range-set.md)), so that terminal is
outside the domain in a way nothing downstream will catch — `-1` is EOF, and
these are further out still. The input is a mistake at the call site, and a
lone surrogate cannot be a code point terminal under any reading, so there is
nothing to represent and nothing to fall back to.

This is the "answered with a plausible wrong value" case
[AGENTS.md §1](../../../AGENTS.md#1-workflow) names, so it wants a fix rather
than a long life as an issue.

### Proposal

Check the tag where the code points arrive — `set` and `range` both go through
`stringToCodePointList` — and refuse a list carrying one. `errorMask` is
exported from `fjs/text/code_point/module.f.mjs`, which already documents the
test as `codePoint & errorMask`.

### Tasks

- [ ] Refuse a code point carrying `errorMask` in `set` and in `range`.
- [ ] Prove both refusals: a lone high surrogate, a lone low surrogate, and a
      well-formed astral pair that must still be accepted as one symbol.

### Related

- [`../module.f.mjs`](../module.f.mjs) — `set`, `range`.
- [`fjs/text/utf16/module.f.mjs`](../../text/utf16/module.f.mjs) — the decoder
  that tags rather than throws.
- [ebnf-range-set](../../bnf/todo/ebnf-range-set.md) — ordinary symbols are the
  non-negative safe integers.
