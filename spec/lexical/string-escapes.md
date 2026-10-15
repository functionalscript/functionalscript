# String Escapes and Quotes

**Status:** JSON's escapes and `\'` implemented; JavaScript's other escapes are refused

A string is JSON's, between double quotes or between single quotes:

```js
export default ["hello!", 'hello!'];
```

Between double quotes it is exactly JSON's string: JSON's escapes — `\"`,
`\\`, `\/`, `\b`, `\f`, `\n`, `\r`, `\t`, and `\uXXXX` — and no unescaped `"`,
`\` or C0 control character (U+0000 through U+001F). Between single quotes it
is the same with the delimiters swapped: a `"` stands for itself, and `\'` is
the one escape it adds, so `'it\'s'` and `"it's"` are one string. Every other
code point may stand raw in either quote, as in JSON: DEL (U+007F), the C1
controls (U+0080 through U+009F), U+FEFF, U+2028 and U+2029, and a code point
above U+FFFF included. The quote is a spelling, not part of the value, and
every output writes the string between double quotes.

`\'` stays refused between double quotes, where JavaScript accepts it, so a
double-quoted string is always a JSON string. JavaScript's other spellings —
the `\v`, `\0`, `\xHH` and `\u{…}` escapes, a raw TAB or other C0 control
character, a line continuation — are refused in both quotes; see
[js-string-literals](../todo/2460-js-string-literals.md). Backtick-delimited
[template literals](../README.md#template-literals) have their own expression syntax.

This holds at every string position of a module: a value, an object key,
plain or in brackets, the key of a property access in brackets (`o['k']`),
the path of an `import` statement and the value of its attribute —
`with { type: 'json' }` is the attribute `with { type: "json" }` is.

## Examples

The compiler demo offers the programs `stringEscapes` in [`module.f.js`](./module.f.js), each with its real output.

## Reference

- ECMA-262: [String literals](https://tc39.es/ecma262/#sec-literals-string-literals)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#string_literals>
