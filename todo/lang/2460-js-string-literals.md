# JS String Literals

String literals at every level — JSON, DJS, FJS — use JSON string syntax:
double quotes, the JSON escapes (`\"` `\\` `\/` `\b` `\f` `\n` `\r` `\t`
`\uXXXX`), and no literal control characters
([RFC 8259 §7](https://www.rfc-editor.org/rfc/rfc8259#section-7)).

This feature adds the rest of the ECMAScript string literal syntax as
syntactic sugar:

- single-quoted strings: `'hello'`,
- additional escapes: `\v`, `\0`, `\xHH`, `\u{XXXXXX}`,
- literal C0 control characters, e.g. a raw TAB inside a string,
- line continuations: `\` before a line terminator.

```js
export default 'a\tb\x41\u{1F600}'
```

## Rationale for deferring

JSON string syntax already denotes every JS string value: each UTF-16 code
unit, including lone surrogates, is reachable via `\uXXXX`. So this feature
adds alternative spellings, not new values.

Design rule: we extend JSON only where JS has values JSON cannot express
(`undefined`, `bigint`, functions). Alternative spellings of expressible
values are syntactic sugar and get the lowest priority.

Keeping a single string grammar across the JSON ⊂ DJS ⊂ FS lattice also
avoids parser differentials ("is it valid JSON?" is answerable at the string
level) and keeps values closer to a canonical byte form for content
addressing.

Until implemented, JS spellings can be normalized into JSON spellings
mechanically:
`'x'` → `"x"`, literal TAB → `\t`, `\v` → `\u000b`, `\x41` → `A`.

**Note**: template literals are not part of this feature — they involve
expression interpolation, not just lexical syntax.

**Note**: if a universal parser — one that recognizes JSON, DJS, and FS in a
single pass — implements this feature, it must still distinguish JS strings
from JSON strings: a string literal using any of the JS-only spellings above
is not a JSON string, and the parser has to report the input as outside
JSON (it stays valid DJS/FS, since this feature is DJS-level sugar). For
example, via two grammar rules (`json-string` ⊂ `js-string`) sharing the
escape sub-rules, or by recording which sub-language each matched token
stayed within.

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#string_literals>
