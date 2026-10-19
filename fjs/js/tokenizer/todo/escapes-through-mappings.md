## The token layer re-lexes the escapes the grammar already parsed

**Priority:** P3
**Status:** open

### Problem

`lex` runs the [`fjs/ebnf/lib/js`](../../../ebnf/lib/js/module.f.mjs) grammar
with no mapping set, keeps a token's code points, and `toJsToken` re-scans
that text to find the cooked value: `stringDecodeScan` and `decodeString` for
a quoted string, `templateDecodeStep` and `decodeTemplate` for a template,
with `escape`, `unicode` and `hex` states and four-digit accumulation in
`fixedHexValue` — a second scanner over text whose `string → escape` nodes
the parse already isolated.
[`fjs/media/json/parser`](../../../media/json/parser/module.f.mjs) reads the
same `escape` rule — `lib/js` takes its `u: unicode` sub-rule from
[`fjs/ebnf/lib/json`](../../../ebnf/lib/json/module.f.mjs) — through a
mapping, `escapeMapping` in `stringMappings`:

```js
// json/parser — a mapping on the grammar's escape node
const unit = assertNotNullish(hexDigitsValue(unmapped(digits).map(hexDigitUnit)))
return textTag.symbol(fromCharCode(Number(unit)))
// js/tokenizer — a scanner over the token's text
case 'unicode': {
    const digits = [...state.digits, cp]
    return digits.length === 4 ? [[fixedHexValue(digits)], { kind: 'normal' }] : /* … */
}
```

so `\uXXXX` is decoded once per reader, and
[`fjs/compiler/tokenizer`](../../../compiler/tokenizer/module.f.mjs)'s
`templateSourceAccepted` scans template text once more. The scanner's
totality is argued from the grammar it duplicates — "the grammar's `string`
rule only ever accepts …" — which is the separation the mapping layer exists
to make unnecessary.

### Proposal

Give the token layer a rewrite set, as the JSON reader has. The string
mappings move down to `lib/json`, beside the rules they map, and they do
not move alone: `escapeMapping` and `characterMapping` close over `textTag`,
the `Text` symbol `tagged('text', 'value')` makes, and `stringMappings` is
read back through `textAt`, all of which `json/parser` owns today and the
DataJS parser imports from it. The layer that moves is the whole of it —
`tagged` and the `Text` tag, `textAt`, the three string mappings — into
`lib/json` or a module beside it, so that `json/parser`, `datajs/parser`
and the tokenizer each import the grammar's reader of its own strings and
none imports another reader. That is the one owner
[parser-meta-accessors](../../../media/todo/parser-meta-accessors.md) is
already giving the tagged-symbol accessors, and this lands on it. The layer
is written over an alphabet, and the two grammars run over different ones:
the JSON grammar over UTF-16 units, so `characterMapping` is a
`Mapping<Utf16, Text>` that reads a plain symbol with
`fromCharCode(unitAt(…))`, and `lib/js` over code points, which the
tokenizer's proofs pin for a character outside the BMP. Reused as it
stands, the mapping would read U+1F600 as U+F600. So the moved layer takes
its character reader as a parameter — `unitAt` with `fromCharCode` for the
JSON grammar, the code point with `fromCodePoint` for `lib/js` — and each
grammar's `character` mapping is that one instantiation; the escape
mappings compute from hex digits and `\u{…}` answers a code point, so the
text a string's characters join to is built by code point on the
tokenizer's side. `lib/js` adds one mapping for
`singleQuoteEscape` and one for `templateEscape` — `\x`, `\u{…}`, line
continuation, `\0`, with the `valid` flag as the mapping's result.
`toJsToken` reads the cooked value and the `source` provenance off the node.
`stringDecodeScan`, `templateDecodeStep` and the `_StringDecode` and
`_TemplateDecode` types in `private.ts` go; `templateSourceAccepted` reads
the escape nodes rather than the text. The remaining escapes in
[single-quote-and-template-lexing](../../../ebnf/lib/js/todo/single-quote-and-template-lexing.md)
then become one grammar branch plus one mapping arm each.

### Tasks

- [ ] The text-tag layer — `tagged`, the `Text` tag, `textAt` and the string
      mappings, over a character reader given — in `lib/json` or beside it,
      on parser-meta-accessors' owner; `json/parser` and `datajs/parser`
      import it over UTF-16 units, `lib/js` over code points.
- [ ] Mappings for `singleQuoteEscape` and `templateEscape` in `lib/js`.
- [ ] `toJsToken` over the mapped nodes; the scanners and their state types
      go.
- [ ] `compiler/tokenizer` reads the nodes.

### Related

- [single-quote-and-template-lexing](../../../ebnf/lib/js/todo/single-quote-and-template-lexing.md)
  — the escapes still to add.
- [mapping-precheck](../../../ebnf/ll1/todo/mapping-precheck.md) — what a
  mapping may assume.
- [parser-meta-accessors](../../../media/todo/parser-meta-accessors.md) —
  the one owner of the tagged-symbol accessors this builds on.
