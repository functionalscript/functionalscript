# JS String Literals

**Priority:** P5, for the [rest](#deferred-the-other-spellings)
**Status:** open — [single quotes](#proposal-single-quotes-first) are
implemented; the other spellings are deferred

A JSON string literal is double-quoted, with the JSON escapes (`\"` `\\` `\/`
`\b` `\f` `\n` `\r` `\t` `\uXXXX`) and no literal control characters
([RFC 8259 §7](https://www.rfc-editor.org/rfc/rfc8259#section-7)), and so is
a DataJS one. A FunctionalScript string literal is JSON's between double
quotes or, since [#2251](https://github.com/functionalscript/functionalscript/pull/2251),
between single quotes ([scope](#scope)).

ECMAScript's string literal syntax has four spellings beyond JSON's:

- single-quoted strings: `'hello'` — FunctionalScript's, as above,
- additional escapes: `\v`, `\0`, `\xHH`, `\u{XXXXXX}`,
- literal C0 control characters, e.g. a raw TAB inside a string,
- line continuations: `\` before a line terminator.

```js
export default 'a\tb\x41\u{1F600}'
```

None of them adds a value: JSON string syntax already denotes every JS string
value, each UTF-16 code unit, lone surrogates included, being reachable via
`\uXXXX`. The first spelling is FunctionalScript's
([#2251](https://github.com/functionalscript/functionalscript/pull/2251)); the
other three stay deferred.

**Language-design approval:** `sergey-shandar` approved the
[single-quote scope](#scope) in
[#2243](https://github.com/functionalscript/functionalscript/pull/2243#pullrequestreview-5309337958),
as [DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)
requires. The approval covers the scope; [where it lives](#where-it-lives)
was corrected after it, in the same pull request, to agree with the lexing
issue below, and changes no accepted spelling.

## Problem

Single quotes are the most common string spelling in this repository's own
source, so this sugar is what keeps the compiler from reading the repository.
At `a08c20a`, compiling each module that

```sh
find fjs -name '*.f.mjs' -not -name 'proof.f.mjs'
```

lists with `node ./fjs/module.mjs compile <module> <output>.rs`, and reading
the character at each reported error, compiled 2 of 194: the two
`fjs/fsc/examples` inputs. Of the 192 refusals, 179 were an
`unexpected token` at a single-quoted string, 159 of them in the module's
first `import` line (`import { … } from '../…'`). The rest stop at a template
literal, a named parameter, a named import, a `0x` literal or a multi-line
`const`. The first error is the only one reported, so every construct later in
those modules is invisible until quotes parse.

That matters for the MVP: the [roadmap](../../nanvm-lib/todo/mvp-roadmap.md)'s
repository-coverage task, and self-hosting after it, are the compiler
compiling these modules. The other route, rewriting every `'…'` in the
repository as `"…"`, touches most source files, conflicts with every open pull
request, and changes code that is already correct JavaScript to suit a
restriction that protects no guarantee — the case
[DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
tells us not to make.

### After single quotes

Re-run with single quotes in, the same command over the same file set at
the head of [#2251](https://github.com/functionalscript/functionalscript/pull/2251)
still compiles the same two modules, since each module's next gap was hidden
behind its first. No module stops at a single-quoted string that uses JSON's
escapes; six stop at one that uses another JavaScript escape, which stays
deferred below. The first gap is now a template literal in about seventy
modules, a named import in about as many, and a `0x`, `0b` or `_`-separated
number literal in about forty, with named parameters, destructuring and
statement terminators behind them.

## Proposal: single quotes first

### Scope

A string literal may be delimited by `'` as well as `"`:

- Inside `'…'`, the escapes are JSON's plus `\'`. A literal `"` needs no
  escape, and `\"` is accepted too, as in JavaScript.
- Everything JSON refuses inside `"…"` stays refused inside `'…'`: a literal
  control character — a line feed and a carriage return among them — and the
  other JavaScript escapes (`\v`, `\0`, `\xHH`, `\u{…}`). What JSON admits
  stays admitted: U+2028 and U+2029, the two line terminators that are not
  control characters, may stand raw in either quote, as they may in a JSON
  string and, since ES2019, in a JavaScript one.
- `"…"` does not change: it stays exactly JSON's string, so `"\'"` stays
  refused. JavaScript accepts it, so this is a restriction: it keeps "is this
  double-quoted string JSON?" answerable by the JSON grammar alone. Admitting
  `\'` there too is the alternative, and it costs that property for a spelling
  nobody needs.
- The value is the same as the double-quoted spelling's: `'a"b'` and
  `"a\"b"` denote one string. Nothing is added to the value model, the EDAG
  or the Rust printer.
- Every place a string is written takes it: values, object keys and `import`
  paths.
- Output is unchanged. Every `fjs compile` output that writes a string
  (`.js`/`.mjs`, `.data.js`, `.json`) keeps writing JSON's double-quoted form,
  the canonical spelling of the value. The output's spelling is the writer's,
  not the source's.

### Where it lives

Recognising a spelling and accepting it are two layers, and
[single-quote-and-template-lexing](../../fjs/ebnf/lib/js/todo/single-quote-and-template-lexing.md)
already owns the first: it widens the JS token grammar to every JavaScript
string spelling, while the compiler's fold in `fjs/fsc/tokenizer` goes on
refusing what the language does not accept. This document is the second
layer for single quotes: what the fold stops refusing.

- **Grammar.** JSON's grammar does not change. `fjs/ebnf/lib/js` gains a JS
  string rule beside JSON's `string`, opened and closed by the same one of
  `"` and `'`, sharing JSON's character and escape sub-rules. A single-quoted
  literal is a JS string, never a JSON one, and a reader of JSON never sees
  the rule. Whether this lands with `\'` alone or with the lexing issue's
  whole escape rule is a sequencing choice; the fold below decides
  acceptance either way.
- **Decoding.** `\'` is decoded above `simpleEscapes` in
  `fjs/js/string_escape`, in the JS string's own decoder, and **not** added
  to that table: the table is shared with `fjs/media/json/serializer`'s
  encoder, which would then write `\'` for every apostrophe, and JSON has no
  such escape. This is the lexing issue's rule, the listed escapes, else the
  character itself, of which `\'` is the first case.
- **Token.** A cooked value alone cannot tell the fold what to accept once
  the grammar recognises more than it: `'A'`, `"A"` and `"\x41"` all cook to
  `A`, and a single "is JSON" bit cannot tell the first, accepted, from the
  third, refused. So a `string` token records two facts, decided by the
  decoder as it reads each escape:
  - `quote`, `"` or `'`;
  - `jsonEscapes`, true when every escape is one of JSON's or the literal's
    own quote escaped, and no raw control character or line continuation
    occurs.

  The lexing issue's `json` flag is `quote === '"' && jsonEscapes`, derived
  rather than stored. The fold accepts a string when `jsonEscapes` holds, of
  either quote, so `'a\'b'` and `'a"b'` pass and `"\'"` and `'\x41'` do
  not.
- **Parser.** The fold turns a refused string into the error token it
  produces today and hands an accepted one on as a `string` token with its
  value, so nothing in `fjs/fsc/parser` changes.

**As implemented**, the grammar landed before the lexing issue's widening, so
it recognises exactly what the language accepts: `fjs/ebnf/lib/js`'s `string`
is JSON's double-quoted rule or a single-quoted one whose escape rule is
JSON's with `'` added, and `"\'"` and `'\x41'` are refused by the grammar
itself, as every non-JSON escape already was. With nothing recognised that
the language refuses, `quote` and `jsonEscapes` would be constants and the
fold would have nothing to check, so neither was added. They arrive with the
widening, which is when the fold first needs them, and the design above is
what they are to be.

### Benefits

- Familiar source compiles as written: the dominant spelling in the repository
  and in most JavaScript code.
- The biggest unblock for repository coverage: the first error in most modules
  moves to their next real gap, which is what the coverage work needs to see.
- Small and contained: a grammar alternative, a decoder above the shared
  escape table, two token fields and the fold's check, with proofs. No new
  value, node or output.

### Drawbacks

- One more string spelling to read, and two spellings of one value in source.
  Canonical output keeps content addressing on one form.
- `"\'"` is refused where JavaScript accepts it (see [scope](#scope)).
- Every input the FSC tokenizer (`fjs/fsc/tokenizer`) reads gains it at once.
  DataJS's own grammar, `fjs/ebnf/lib/datajs`, is separate and does not
  change here; whether it follows is its own decision, which the deferral
  note below already calls "DJS-level sugar".

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

- [x] Record the approving language designer and a direct link to the
      approval of the [scope](#scope).
- [x] `fjs/ebnf/lib/js`: the JS string rule, opened and closed by the same
      one of `"` and `'`; JSON's grammar unchanged.
- [x] `fjs/js/tokenizer`: decode `\'` above `simpleEscapes`, leaving that
      table and the JSON serializer unchanged, with proofs that `'…'` and
      `"…"` cook to the same value and that `"\'"`, `'\x41'`, a raw control
      character and a line feed inside `'…'` are refused.
- [ ] `quote` and `jsonEscapes` on the `string` token, and the check in
      `fjs/fsc/tokenizer`'s fold: with the lexing issue's widening, not
      before ([as implemented](#where-it-lives)).
- [x] `fjs/fsc`: prove a single-quoted value, key and `import` path compile to
      the same output as their double-quoted spellings.
- [x] `spec/README.md`, Strings: describe both delimiters and the refusals.
- [x] Re-run the repository survey above and record where the modules stop
      next: see [after single quotes](#after-single-quotes).
