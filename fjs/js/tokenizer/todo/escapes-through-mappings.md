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
`templateSourceAccepted` scans template text a fourth time. The scanner's
totality is argued from the grammar it duplicates — "the grammar's `string`
rule only ever accepts …" — which is the separation the mapping layer exists
to make unnecessary.

### Proposal

Give the token layer a rewrite set, as the JSON reader has. `escapeMapping`
and `characterMapping` move down to `lib/json`, beside the rules they map, so
neither reader imports the other; `lib/js` adds one mapping for
`singleQuoteEscape` and one for `templateEscape` — `\x`, `\u{…}`, line
continuation, `\0`, with the `valid` flag as the mapping's result.
`toJsToken` reads the cooked value and the `source` provenance off the node.
`stringDecodeScan`, `templateDecodeStep` and the `_StringDecode` and
`_TemplateDecode` types in `private.ts` go; `templateSourceAccepted` reads
the escape nodes rather than the text. The remaining escapes in
[single-quote-and-template-lexing](../../../ebnf/lib/js/todo/single-quote-and-template-lexing.md)
then become one grammar branch plus one mapping arm each.

### Tasks

- [ ] `escapeMapping` and `characterMapping` in `lib/json`; `json/parser`
      imports them.
- [ ] Mappings for `singleQuoteEscape` and `templateEscape` in `lib/js`.
- [ ] `toJsToken` over the mapped nodes; the scanners and their state types
      go.
- [ ] `compiler/tokenizer` reads the nodes.

### Related

- [single-quote-and-template-lexing](../../../ebnf/lib/js/todo/single-quote-and-template-lexing.md)
  — the escapes still to add.
- [mapping-precheck](../../../ebnf/ll1/todo/mapping-precheck.md) — what a
  mapping may assume.
