# Identifiers

**Status:** ASCII names implemented; non-ASCII names and Unicode escapes are not implemented yet and are refused

An identifier is ASCII: a letter `A`–`Z` or `a`–`z`, `_` or `$`, then any
number of those or the digits `0`–`9`. `a`, `_x`, `$0` and `a_$1` are
identifiers, and `1a` is not. Every word is spelled this way — a `const`,
`import` or parameter name, an identifier key, the name after `.`, and the
keywords — and which words may name a binding is the reserved-word rule of
[shared values](../bindings/constants.md): a reserved word may still be a key
or a property name, `{ if: 1 }` and `a.default` included.

The rest of JavaScript's identifier grammar is not recognized yet
([roadmap](../todo/README.md)), and each of its other spellings is a
compilation error: a non-ASCII character in a name, a letter
(`const é = 1;`, `{ π: 1 }`, `o.é`) or U+200C or U+200D (ZWNJ, ZWJ)
included, and a Unicode escape in a name (`const \u0061 = 1;`, `\u{61}`,
`{ \u0069f: 1 }`). Non-ASCII text is fine inside a string, so such a key is
written as one: `{ "é": 1 }`, `o["é"]`.

## Examples

The compiler demo offers the programs `identifiers` in [`module.f.js`](./module.f.js), each with its real output: one accepted, one refused with the compiler's own message.

## Reference

- ECMA-262: [Names and keywords](https://tc39.es/ecma262/#sec-names-and-keywords)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#identifiers>
