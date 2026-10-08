## `?.` before a digit is the conditional

**Priority:** P5
**Status:** open

### Problem

`operator` in [`fjs/ebnf/lib/js`](../../../ebnf/lib/js/module.f.mjs) is the
prefix tree of `operators`: it reads the longest operator its lookahead leads
to, `?.` included. ECMAScript's `OptionalChainingPunctuator` is `?.` not
followed by a decimal digit, so JavaScript reads `a?.5:1` as `a ? .5 : 1`, a
conditional whose middle arm is `.5`. `tokenize` in
[`../module.f.mjs`](../module.f.mjs) reads the identifier `a`, then `?.`,
then the number `5`.

Nothing is wrong yet. A leading-dot number is not recognized
([numbers](../../../../spec/README.md#numbers)), so the JavaScript reading is
refused anyway: the parser reads `a?.b` as the optional chain it is
([optional chaining](../../../../spec/README.md#optional-chaining)) and wants
a name, `[` or `(` after the `?.`, so `export default a?.5:1;` fails, as it
should, at the `5` rather than at the `.5`. The day `.5` is recognized,
`a?.5:1` is a valid conditional, and a tokenizer that still reads `?.` there
refuses it.

### Proposal

Land it with leading-dot numbers: whichever layer reads `.5` as a number
reads a `?.` directly followed by a decimal digit as `?` and that number. The
one-token grammar decides on one symbol after the `?`, which is the `.`, so
the split belongs to the fold in `tokenize`, beside the check it already makes
of a number against the token next to it — or to the grammar, if leading-dot
numbers reshape the `.` branch of `operator` anyway.

### Tasks

- [ ] With leading-dot numbers, `a?.5:1` tokenizes as `a`, `?`, `.5`, `:`,
      `1` and compiles as `a ? .5 : 1` does, while `a?.b` still tokenizes as
      `a`, `?.`, `b`; both pinned in [`../proof.f.mjs`](../proof.f.mjs).

### Related

- [ECMAScript, `OptionalChainingPunctuator`](https://tc39.es/ecma262/#prod-OptionalChainingPunctuator)
  — the lookahead the prefix tree leaves out.
- [The roadmap](../../../../spec/todo/README.md) — number spellings beyond
  JSON's, leading-dot numbers among them.
- [`spec/todo/2335-optional-chaining.md`](../../../../spec/todo/2335-optional-chaining.md)
  — the optional chains, which read the `?.` this task is about.
