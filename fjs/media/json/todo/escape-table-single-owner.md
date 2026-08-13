## The string-escape table has three copies

**Priority:** P3
**Status:** open

### Problem

One mapping — `" \ / b f n r t` ↔ `" \ / BS FF LF CR HT`, plus `\uXXXX` —
is written three times:

- `fjs/media/json/serializer/module.f.mjs:38-46` — `escapeTable`, a lookup
  table (encode side);
- `fjs/js/tokenizer/module.f.mjs:582-591` — a range-map dispatch (decode
  side);
- `fjs/djs/tokenizer/module.f.mjs:344-374` — a switch in `stringDecodeScan`
  (decode side).

[667-js-tokenizer-handler-literals](../../../js/todo/667-js-tokenizer-handler-literals.md)
§3 proposes an `escapeTo` `(letter, char)` table, but scoped inside
`js/tokenizer` only — it never mentions `djs/tokenizer`'s decoder or the
serializer's encode-side table, so the cross-module owner question stays
open.

Also worth flagging to whoever picks up [157](../../../djs/todo/157.md): that
issue opens by asserting both tokenizers "delegate all character
classification, escape decoding, and number parsing" to `js/tokenizer`. That
is no longer true of the grammar-based DJS tokenizer, which imports only
`isKeywordToken` and re-implements escape decoding, keyword classification,
and number decoding itself.

### Proposal

One module owning the bidirectional simple-escape table — natural home: next
to the JSON string grammar that
[bnf-grammar-single-owner](bnf-grammar-single-owner.md) creates — consumed by
the serializer's `escapeCodePoint` and both decoders.

### Tasks

- [ ] Define the table once (letter ↔ code point pairs), derive encode and
      decode views from it
- [ ] Convert the three sites
- [ ] Correct 157's premise when touching it

### Related

- [bnf-grammar-single-owner](bnf-grammar-single-owner.md) — same "one owner"
  move for the grammar itself
- [667-js-tokenizer-handler-literals](../../../js/todo/667-js-tokenizer-handler-literals.md)
  — the `js/tokenizer`-local half of this
