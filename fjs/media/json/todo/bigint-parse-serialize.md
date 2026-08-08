## Parse and serialize JSON integers as bigint

**Priority:** P3
**Status:** open

### Problem

Native JavaScript JSON handling materializes every JSON number as a `number`.
Large integer literals therefore lose precision even though JSON syntax itself
does not impose the IEEE-754 safe-integer limit.

We need an intermediate JSON representation that can carry exact integers as
`bigint`. In particular, BNF data will need this once its symbols and terminal
ranges move from `number` to `bigint`.

The existing default `fjs/media/json` behavior should continue to match standard
JavaScript JSON semantics for callers that want `JSON.parse` / `JSON.stringify`
compatibility at the value level. Bigint-aware parsing/serialization is an
additional representation over the same JSON syntax, not a change to ordinary
JSON parsing.

### Proposal

Add a bigint-aware JSON parse/serialize pair that still reads and writes ordinary
JSON text.

On parse, use the JSON number token's lexical form:

```text
123       -> 123n
-123      -> -123n
1.5       -> 1.5
1e3       -> 1000 as number
1.0       -> 1 as number
```

A number token with no decimal point and no exponent is an integer and becomes a
`bigint`; fraction or exponent syntax becomes a JavaScript `number`. Reuse the
existing tokenizer's exact numeric representation rather than converting an
integer through `number` first.

On serialization:

- emit `bigint` as ordinary decimal JSON integer syntax, without an `n` suffix;
- emit `number` using JSON number syntax;
- when a finite `number` would otherwise serialize as integer syntax, preserve
  the type distinction by emitting a decimal form such as `3.0` so parsing the
  result returns `number`, not `bigint`.

Thus both `3n` and `3` can round-trip while the serialized text remains valid
JSON:

```text
3n -> 3   -> 3n
3  -> 3.0 -> 3
```

Do not introduce tagged objects or quote large integers as strings. The purpose
of this representation is to preserve JSON's native number grammar while making
its integer branch exact.

Prefer factoring the existing JSON parser/serializer so ordinary JSON and the
bigint-aware representation share the same tokenizer, structural parser, and
serialization machinery with only their numeric leaf mapping differing.

### Tasks

- [ ] Define the bigint-aware JSON value type (`bigint` for integer leaves,
      `number` for fractional/exponent leaves).
- [ ] Factor the JSON parser so number-token conversion can be supplied without
      duplicating the structural parse state machine.
- [ ] Parse bare JSON integer syntax directly to `bigint` from the tokenizer's
      exact numeric value.
- [ ] Parse decimal and exponent syntax to `number`.
- [ ] Add a serializer that emits `bigint` as plain decimal digits and preserves
      whole-valued `number` leaves with decimal/exponent syntax.
- [ ] Keep the existing ordinary JSON parse/serialize API behavior unchanged.
- [ ] Add round-trip proofs for integers beyond `Number.MAX_SAFE_INTEGER`,
      negative integers, zero, whole-valued numbers, fractions, and exponents.
- [ ] Document that the output is valid JSON but native JavaScript `JSON.parse`
      may lose precision when consuming large integer literals.
- [ ] `npx tsc`, `fjs test`.

### Related

- [BNF bigint symbols](../../../bnf/todo/bigint-symbols.md) — consumes this
  representation so bigint-valued BNF data remains JSON-serializable.
- [`fjs/djs/todo/json-bigint-serialization.md`](../../../djs/todo/json-bigint-serialization.md)
  — djs-specific integration and `.json` output should build on this generic
  JSON representation rather than defining another one.
- [Integer literal `123` is a `bigint`](../../../../todo/blocked/integer-as-bigint.md)
  — broader language-level bigint-literal direction; this task is only a JSON
  representation.
