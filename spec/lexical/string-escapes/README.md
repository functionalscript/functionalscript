# String Escapes and Quotes

**Status:** implemented, including braced Unicode escapes

Quoted strings admit JSON escapes and `\u{…}`. Single quotes add the escapes
described below:

```js
export default ["hello!", 'hello!'];
```

Between double quotes it admits JSON's escapes — `\"`,
`\\`, `\/`, `\b`, `\f`, `\n`, `\r`, `\t`, and `\uXXXX` — and no unescaped `"`,
`\` or C0 control character (U+0000 through U+001F). Between single quotes
the delimiters are swapped: a `"` stands for itself, and `\'` escapes the
apostrophe, so `'it\'s'` and `"it's"` are one string. Single quotes also
accept `\xHH`, exactly two hexadecimal digits denoting a UTF-16 code unit
from U+0000 through U+00FF, and `\v`, denoting U+000B (vertical tab).
Hexadecimal digits may use either case: `'\x41'` and `"A"` are one string,
as are `'\v'` and `"\u000b"`. Every other
code point may stand raw in either quote, as in JSON: DEL (U+007F), the C1
controls (U+0080 through U+009F), U+FEFF, U+2028 and U+2029, and a code point
above U+FFFF included. The quote is a spelling, not part of the value, and
every output writes the string between double quotes.

`\'`, `\xHH` and `\v` stay refused between double quotes, where JavaScript
accepts them, while braced Unicode escapes are accepted in either quote style. JavaScript's
other spellings — the `\0` escape, a raw TAB or other C0 control
character, a line continuation — are refused in both quotes; see
[js-string-literals](../../todo/2460-js-string-literals.md). Backtick-delimited
[template literals](../../values/template-literals/README.md) have their own
expression syntax and escape policy; `\xHH` and `\v` remain refused there.

A braced Unicode escape has one or more hexadecimal digits between braces,
with a value from `0` through `0x10ffff`. Leading zeros and either hex case
are allowed. For example, `'\u{1f600}'`, `"\ud83d\ude00"` and `"😀"`
denote the same string. Surrogate values such as `\u{d800}` remain lone
UTF-16 code units, as in JavaScript. Empty braces, malformed digits, missing
braces and values above the limit are rejected. The spelling is also admitted
in templates. JSON and DataJS retain their own string grammars.

The language designer `sergey-shandar` approved this increment in the
[working session](https://chatgpt.com/local/01a19f43-23cd-76b0-9836-c24644dc8019),
under DESIGN.md §12.

The NUL shorthand `\0` is intentionally prohibited. Use `\u0000` in
any delimiter, or `\x00` in single quotes. Both are fixed-width and remain
unambiguous when a digit follows. Literal backslash-zero text is still ordinary
string data, for example `\\0` inside a quoted source string.

This holds at every string position of a module: a value, an object key,
plain or in brackets, the key of a property access in brackets (`o['k']`),
the path of an `import` statement and the value of its attribute —
`with { type: 'json' }` is the attribute `with { type: "json" }` is.

## Examples

The compiler demo offers the programs `stringEscapes` in [`module.f.js`](../module.f.js), each with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — a JSON escape, `\\'` in single quotes,
and a `\\u` escape, each string's length — with every output `fjs compile`
makes of it: the expression graph (EDAG), the Rust and the WebAssembly that
Rust builds to. Its Run button calls the default export with `0`, `1` and
`2`, as JavaScript and as WebAssembly, and shows what each call returned or
threw.

```js
export default (...a) => ["tab\there", 'it\'s', "\u0041"][Number(a[0])].length;
```

## Reference

- ECMA-262: [String literals](https://tc39.es/ecma262/#sec-literals-string-literals)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#string_literals>
