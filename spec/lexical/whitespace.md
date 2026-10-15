# Whitespace and Line Terminators

**Status:** implemented; JavaScript's other whitespace is refused, see the page

Whitespace is a space (U+0020) or a tab (U+0009). A newline is a line feed
(LF, U+000A), a carriage return (CR, U+000D), or CR followed by LF, which is
one line break. Those are JSON's four whitespace characters, the same four
[DataJS](../datajs/README.md#whitespace) admits.

Trivia may stand between any two tokens, before the first and after the last,
and it is insignificant there, newlines included, but for one: a statement
written without its `;` ends at the newline before the next statement
([module structure](../README.md#module-structure)). Inside an expression a line break
reads as a space does, exactly as JavaScript reads it: `a` followed by
`.length`, `[0]` or `+ 2` on the next line is `a.length`, `a[0]` or `a + 2`,
and `f` followed by `(1)` is the call `f(1)`. Trivia is needed only where two
tokens would otherwise read as one: `const a`, not `consta`
([module structure](../README.md#module-structure)); `1 .x`, not `1.x`
([property access](../README.md#property-access)).

The exceptions are the boundaries JavaScript restricts, before `=>` and after
`return` and `throw`, where a line break is refused ([functions](../README.md#functions)). There the
trivia is a line break if a newline of any of the three forms stands in it,
inside a block comment or not ([comments](./comments.md)).

Nothing else is trivia. JavaScript's other whitespace — VT (U+000B), FF
(U+000C), U+FEFF, and the Unicode space separators such as NBSP (U+00A0) and
U+3000 — is refused, although JavaScript accepts it, a byte order mark at the
start of the file included ([source text](../README.md#source-text)). JavaScript's other
two line terminators, U+2028 and U+2029, may stand raw only inside a
[string](../README.md#strings), as in JSON; anywhere else, a comment included, they are
refused, since an invisible line break is no line break here. A hashbang
comment, `#!` at the start of the file, is refused too, although JavaScript
admits one ([hash comments](../../fjs/compiler/todo/083-compiler-hash-comments.md)). Any
other character outside a string or a comment is part of a token or an
error, as it is in JavaScript.

## Examples

None yet: `whitespace` in [`module.f.js`](./module.f.js) is empty, and its first programs — one accepted, one refused with the compiler's own message — are a follow-up.

## Reference

- ECMA-262: [White space](https://tc39.es/ecma262/#sec-white-space), [Line terminators](https://tc39.es/ecma262/#sec-line-terminators)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#white_space>
