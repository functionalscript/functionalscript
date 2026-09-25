## The JSON reader decodes escapes through js/string_escape

**Priority:** P4
**Status:** open

### Problem

[`fjs/js/string_escape`](../../../../js/string_escape/module.f.mjs) is "the
simple string escapes — one source of truth": its module JSDoc says the JSON
serializer and the tokenizers "derive their view from this one list rather
than keeping a copy each", and it exports `escapeToCodePoint` as the decode
view. The JSON serializer (`codePointToEscape`) and `fjs/js/tokenizer`
(`escapeToCodePoint`) do.

The JSON reader does not. [`../module.f.mjs`](../module.f.mjs) keeps its own
table, `simpleEscape` — `{ '"': '"', '\\': '\\', '/': '/', b: '\b', … }` —
and its escape mapping looks the letter up there. That is the second copy the
module's JSDoc says must not exist, and
[`fjs/media/datajs/parser`](../../../datajs/parser/module.f.mjs) inherits it
through `stringMappings`, so DataJS reads escapes through the copy too.

The grammar spells the same set a third time:
[`fjs/ebnf/lib/json`](../../../../ebnf/lib/json/module.f.mjs)'s escape rule
admits `set('"\\/bfnrt')`.

### Proposal

Decode a simple escape through `escapeToCodePoint` and drop `simpleEscape`;
the reader's `text` of the resulting code point replaces the table lookup.
Then decide whether the grammar's escape set can be derived from
`simpleEscapes`' letters rather than written out, or whether the grammar keeps
its literal for readability and a proof pins the two equal.

### Tasks

- [ ] The escape mapping in `../module.f.mjs` decodes through
      `escapeToCodePoint`; `simpleEscape` goes. The JSON and DataJS parser
      proofs pass unchanged.
- [ ] Decide how `fjs/ebnf/lib/json`'s `set('"\\/bfnrt')` relates to
      `simpleEscapes`: derived from it, or pinned equal by a proof.
- [ ] `tsc`, `fjs test`.

### Related

- [`fjs/js/string_escape`](../../../../js/string_escape/module.f.mjs) — the
  owner of the table.
- [single-quote-and-template-lexing](../../../../ebnf/lib/js/todo/single-quote-and-template-lexing.md)
  — keeps the JavaScript-only escapes above that table, which stays JSON's.
