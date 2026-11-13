## JS String Literals

**Priority:** P5
**Status:** open — single quotes, including `\xHH` and `\v`, are in the
language ([strings](../values/strings/README.md)); the remaining spellings are deferred

A JSON string literal is double-quoted, with the JSON escapes (`\"` `\\` `\/`
`\b` `\f` `\n` `\r` `\t` `\uXXXX`) and no literal control characters
([RFC 8259 §7](https://www.rfc-editor.org/rfc/rfc8259#section-7)), and so is
a DataJS one. A FunctionalScript double-quoted string literal additionally admits braced Unicode escapes.
Single quotes have been accepted since
[#2251](https://github.com/functionalscript/functionalscript/pull/2251), and
also accept the hexadecimal and vertical-tab escapes described below.

ECMAScript's string literal syntax has four spellings beyond JSON's:

- single-quoted strings: `'hello'` — FunctionalScript's, as above,
- additional escapes: `\v` and `\xHH` are accepted in single quotes;
  `\u{XXXXXX}` is now admitted in both quote styles and templates; `\0` is intentionally prohibited,
- literal C0 control characters, e.g. a raw TAB inside a string,
- line continuations: `\` before a line terminator.

```js
export default 'a\tb\x41\u{1F600}';
```

None of them adds a value: JSON string syntax already denotes every JS string
value, each UTF-16 code unit, lone surrogates included, being reachable via
`\uXXXX`. Single quotes and the bounded escape increment below are
FunctionalScript's; the remaining spellings stay deferred.

### Single quotes: the record

`sergey-shandar` approved the single-quote scope in
[#2243](https://github.com/functionalscript/functionalscript/pull/2243#pullrequestreview-5309337958),
as [DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)
requires, and [#2251](https://github.com/functionalscript/functionalscript/pull/2251)
implemented it. The accepted language, the refusal of `"\'"` and the reason
for it are the specification's [strings](../values/strings/README.md) section;
decoding `\'` above the shared escape table is `fjs/js/string_escape`'s
module documentation. The quoted-string grammar recognises only what the
language accepts, including the bounded increment below. Wider lexical
recognition, token provenance and the compiler's corresponding admission check are
[single-quote-and-template-lexing](../../fjs/ebnf/lib/js/todo/single-quote-and-template-lexing.md)'s
to add. DataJS's own grammar, `fjs/ebnf/lib/datajs`, did not change; whether
it follows is its own admission decision.

### Single-quoted hexadecimal and vertical-tab escapes

This increment admits `\xHH` (exactly two hexadecimal digits) and `\v`
in single-quoted strings. At that increment, double-quoted strings remained JSON strings,
and template admission was unchanged. Templates now also admit `\xHH` and `\v`, as specified in
[template literals](../values/template-literals/README.md). Both spellings decode to the existing
string value: for example, `'\x1b'` equals `'\u001b'` and `'\v'` equals
`'\u000b'`. No FAST, EDAG or runtime operation is needed.

These spellings previously blocked source AST formation in the Git alternates,
Rust demangler and SGR implementation modules. The benefit is admitting familiar
JavaScript spellings used by actual modules; the cost is an additional grammar
alternative, decoder handling and proofs of the quote-specific boundary.
Other JavaScript string spellings remain separate work.

The language designer `sergey-shandar` explicitly requested this parsing and
admission increment in the
[working session](https://chatgpt.com/local/01a1908b-f970-713f-b7cb-e16f7ffb2006).
This records approval under [DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo).

### Deferred: the remaining spellings

The remaining extra escapes (identity escapes), raw control
characters and line continuations stay deferred. Braced Unicode escapes
are now shared by quoted strings and templates; the earlier double-quoted
JSON-only boundary has been superseded.
They are alternative spellings of values JSON already expresses. The NUL
shorthand is separately prohibited below; other spellings remain at the lowest
priority until a concrete need appears.

Design rule: we extend JSON only where JS has values JSON cannot express
(`undefined`, `bigint`, functions), or where a spelling is common enough that
refusing it keeps familiar code from compiling, as single quotes did. Keeping a
single string grammar across the JSON ⊂ DJS ⊂ FJS lattice avoids parser
differentials ("is it valid JSON?" is answerable at the string level) and keeps
values closer to a canonical byte form for content addressing.

Deferred spellings can be normalized into JSON mechanically: literal TAB →
`\t`, `\0` → `\u0000`, `\u{1F600}` → `\ud83d\ude00`. The accepted
single-quoted spellings also have JSON equivalents: `\v` → `\u000b`,
`\x41` → `A`.

### NUL shorthand: prohibited

NUL values are used for Git delimiters, path validation and internal names.
Write them with the fixed-width `\u0000` escape, or `\x00` where admitted.
The `\0` shorthand is intentionally outside FJS: unlike these fixed-width
forms, its validity depends on the character that follows it.

The language designer `sergey-shandar` withdrew the earlier admission proposal
and explicitly requested normalizing the codebase and prohibiting the shorthand
in the [working session](https://chatgpt.com/local/01a19f43-23cd-76b0-9836-c24644dc8019).
No `\0` admission is planned, including in templates. Both `\0a` and
`\00` through `\09` remain refused by the FJS tokenizer.

The codebase rule covers implementation modules, proofs, helpers, demos and
host adapters. Literal backslash-zero text used to describe an invalid input
or in diagnostics is preserved; it is not a source NUL escape. Repository-wide
normalization replaces actual shorthand escapes without changing their values.

**Note**: template syntax and expression interpolation are implemented
separately ([template literals](../values/template-literals/README.md)). That
specification owns template restrictions on extra escapes, raw controls and line
continuations. The NUL shorthand remains prohibited; any other widening of the
escape set must be documented for each delimiter.

**Note**: if a universal parser — one that recognizes JSON, DJS, and FJS in a
single pass — implements any of these spellings, it must still distinguish JS
strings from JSON strings: a string literal using any JS-only spelling is not a
JSON string, and the parser has to report the input as outside JSON. Whether
it is valid DJS or FJS depends on that language's admission policy. This can be
implemented via two grammar rules (`json-string` ⊂ `js-string`) sharing the
escape sub-rules, or by recording which sub-language each matched token stayed within. Single quotes
take the first of those.

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#string_literals>

### Tasks

- [x] Admit single-quoted `\xHH` and `\v`, preserving the double-quoted JSON
      contract and existing template admission.
- [x] Normalize actual `\0` escapes in `module.f.mjs` sources to `\u0000`,
      preserving NUL values and literal backslash-zero output.
- [x] Reject the NUL shorthand proposal, normalize actual source escapes to
      fixed-width spellings, and preserve compiler rejection across strings and
      templates, including every decimal digit after the shorthand.
- [ ] Admit the other escapes, raw control characters or line continuations
      only when a measured need appears, through the admission checks in
      `fjs/compiler/tokenizer`'s fold.

Braced Unicode escapes are implemented; see [string escapes](../lexical/string-escapes/README.md)
for the current contract and designer approval.
