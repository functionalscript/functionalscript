# JS String Literals

**Priority:** P5
**Status:** open — single quotes are in the language
([strings](../README.md#strings)); the other spellings are deferred

A JSON string literal is double-quoted, with the JSON escapes (`\"` `\\` `\/`
`\b` `\f` `\n` `\r` `\t` `\uXXXX`) and no literal control characters
([RFC 8259 §7](https://www.rfc-editor.org/rfc/rfc8259#section-7)), and so is
a DataJS one. A FunctionalScript string literal is JSON's between double
quotes or, since [#2251](https://github.com/functionalscript/functionalscript/pull/2251),
between single quotes.

ECMAScript's string literal syntax has four spellings beyond JSON's:

- single-quoted strings: `'hello'` — FunctionalScript's, as above,
- additional escapes: `\v`, `\0`, `\xHH`, `\u{XXXXXX}`,
- literal C0 control characters, e.g. a raw TAB inside a string,
- line continuations: `\` before a line terminator.

```js
export default 'a\tb\x41\u{1F600}';
```

None of them adds a value: JSON string syntax already denotes every JS string
value, each UTF-16 code unit, lone surrogates included, being reachable via
`\uXXXX`. The first spelling is FunctionalScript's; the other three stay
deferred.

## Single quotes: the record

`sergey-shandar` approved the single-quote scope in
[#2243](https://github.com/functionalscript/functionalscript/pull/2243#pullrequestreview-5309337958),
as [DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)
requires, and [#2251](https://github.com/functionalscript/functionalscript/pull/2251)
implemented it. The accepted language, the refusal of `"\'"` and the reason
for it are the specification's [strings](../README.md#strings) section;
decoding `\'` above the shared escape table is `fjs/js/string_escape`'s
module documentation. The grammar landed before the lexing issue's widening,
so it recognises exactly what the language accepts, and the token's `quote`
and `jsonEscapes` fields and the fold's check are
[single-quote-and-template-lexing](../../fjs/ebnf/lib/js/todo/single-quote-and-template-lexing.md)'s
to add. DataJS's own grammar, `fjs/ebnf/lib/datajs`, did not change; whether
it follows is its own decision, which the deferral note below calls
"DJS-level sugar".

## Deferred: the other spellings

The extra escapes, raw control characters and line continuations stay deferred
at the lowest priority. They are alternative spellings of values JSON already
expresses, and unlike single quotes, no measured repository need stands behind
them.

Design rule: we extend JSON only where JS has values JSON cannot express
(`undefined`, `bigint`, functions), or where a spelling is common enough that
refusing it keeps familiar code from compiling, as single quotes did. Keeping a
single string grammar across the JSON ⊂ DJS ⊂ FS lattice avoids parser
differentials ("is it valid JSON?" is answerable at the string level) and keeps
values closer to a canonical byte form for content addressing.

Until implemented, they can be normalized into JSON spellings mechanically:
literal TAB → `\t`, `\v` → `\u000b`, `\x41` → `A`.

**Note**: template literals are not part of this feature — they involve
expression interpolation, not just lexical syntax. They are tracked separately
as [template-literals](./3440-template-literals.md).

**Note**: if a universal parser — one that recognizes JSON, DJS, and FS in a
single pass — implements any of these spellings, it must still distinguish JS
strings from JSON strings: a string literal using any JS-only spelling is not a
JSON string, and the parser has to report the input as outside JSON (it stays
valid DJS/FS, since this feature is DJS-level sugar). For example, via two
grammar rules (`json-string` ⊂ `js-string`) sharing the escape sub-rules, or by
recording which sub-language each matched token stayed within. Single quotes
take the first of those.

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#string_literals>

## Tasks

- [ ] Admit the other escapes, raw control characters or line continuations
      only when a measured need appears, through the lexing issue's
      `jsonEscapes` check in `fjs/fsc/tokenizer`'s fold.
