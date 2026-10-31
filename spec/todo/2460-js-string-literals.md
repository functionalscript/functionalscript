## JS String Literals

**Priority:** P5
**Status:** open — single quotes are in the language
([strings](../values/strings/README.md)); the other spellings are deferred

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

### Single quotes: the record

`sergey-shandar` approved the single-quote scope in
[#2243](https://github.com/functionalscript/functionalscript/pull/2243#pullrequestreview-5309337958),
as [DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)
requires, and [#2251](https://github.com/functionalscript/functionalscript/pull/2251)
implemented it. The accepted language, the refusal of `"\'"` and the reason
for it are the specification's [strings](../values/strings/README.md) section;
decoding `\'` above the shared escape table is `fjs/js/string_escape`'s
module documentation. The grammar landed before the lexing issue's widening,
so it recognises exactly what the language accepts, and the token's `quote`
and `jsonEscapes` fields and the fold's check are
[single-quote-and-template-lexing](../../fjs/ebnf/lib/js/todo/single-quote-and-template-lexing.md)'s
to add. DataJS's own grammar, `fjs/ebnf/lib/datajs`, did not change; whether
it follows is its own decision, which the deferral note below calls
"DJS-level sugar".

### Deferred: the other spellings

The extra escapes, raw control characters and line continuations stay deferred.
They are alternative spellings of values JSON already expresses. The NUL escape
has a repository use case described below; the other spellings remain at the
lowest priority until a concrete need appears.

Design rule: we extend JSON only where JS has values JSON cannot express
(`undefined`, `bigint`, functions), or where a spelling is common enough that
refusing it keeps familiar code from compiling, as single quotes did. Keeping a
single string grammar across the JSON ⊂ DJS ⊂ FJS lattice avoids parser
differentials ("is it valid JSON?" is answerable at the string level) and keeps
values closer to a canonical byte form for content addressing.

Until implemented, they can be normalized into JSON spellings mechanically:
literal TAB → `\t`, `\v` → `\u000b`, `\x41` → `A`.

### NUL escape: repository use

Implementation modules use NUL characters for Git object and record delimiters,
path validation, symbolic compiler names and Rust character formatting. The
`\0` spelling blocks source AST formation with the current FJS escape subset.
These `module.f.mjs` sources now use the equivalent accepted `\u0000` spelling;
accepting `\0` remains tracked here.

The proposed scope is `\0` in quoted strings and untagged templates, denoting
one NUL character only when no decimal digit follows, as in JavaScript modules.
Spellings such as `\01` and `\08` must remain refused. The benefit is familiar
JavaScript notation already used by repository code; the cost is another
spelling of the same value and a following-digit check.

Language-design approval and implementation are future work. Coordinate them
with [lexical recognition](../../fjs/ebnf/lib/js/todo/single-quote-and-template-lexing.md)
and the template escape policy; this normalization does not widen admission.

**Note**: template syntax and expression interpolation are implemented
separately ([template literals](../values/template-literals/README.md)). That
specification owns template restrictions on extra escapes, raw controls and line
continuations. The proposed NUL escape admission, and any other widening of the
common escape set, must be coordinated across quoted strings and templates.

**Note**: if a universal parser — one that recognizes JSON, DJS, and FJS in a
single pass — implements any of these spellings, it must still distinguish JS
strings from JSON strings: a string literal using any JS-only spelling is not a
JSON string, and the parser has to report the input as outside JSON (it stays
valid DJS/FJS, since this feature is DJS-level sugar). For example, via two
grammar rules (`json-string` ⊂ `js-string`) sharing the escape sub-rules, or by
recording which sub-language each matched token stayed within. Single quotes
take the first of those.

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#string_literals>

### Tasks

- [x] Normalize actual `\0` escapes in `module.f.mjs` sources to `\u0000`,
      preserving NUL values and literal backslash-zero output.
- [ ] Obtain language-design approval and implement `\0` admission for quoted
      strings and untagged templates, including its decimal-digit restriction.
- [ ] Admit the other escapes, raw control characters or line continuations
      only when a measured need appears, through the admission checks in
      `fjs/compiler/tokenizer`'s fold.
