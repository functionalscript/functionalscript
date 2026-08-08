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
0         -> 0n
-0        -> -0 as number
1.5       -> 1.5
1e3       -> 1000 as number
1.0       -> 1 as number
```

A number token with no decimal point and no exponent becomes a `bigint`, except
for the exact token `-0`. JavaScript `bigint` has no negative-zero value, so `-0`
must remain a JavaScript `number` to preserve the information present in the JSON
text. Fraction or exponent syntax also becomes a JavaScript `number`. Reuse the
existing tokenizer's exact numeric representation rather than converting an
integer through `number` first.

On serialization:

- emit `bigint` as ordinary decimal JSON integer syntax, without an `n` suffix;
- emit `number` using JSON number syntax;
- when a finite `number` would otherwise serialize as integer syntax, preserve
  the type distinction by emitting a decimal form such as `3.0` so parsing the
  result returns `number`, not `bigint`;
- preserve negative zero as the exact JSON token `-0`. Detect it with
  `Object.is(value, -0)` instead of relying on native `JSON.stringify`, which
  serializes `-0` as `0`.

This gives a direct one-to-one mapping for the distinct zero values while keeping
all output valid JSON:

```text
0n -> 0    -> 0n
0  -> 0.0  -> 0
-0 -> -0   -> -0
3n -> 3    -> 3n
3  -> 3.0  -> 3
```

Do not introduce tagged objects or quote large integers as strings. The purpose
of this representation is to preserve JSON's native number grammar while making
its integer branch exact.

Prefer factoring the existing JSON parser/serializer so ordinary JSON and the
bigint-aware representation share the same tokenizer, structural parser, and
serialization machinery with only their numeric leaf mapping differing.

### Tasks

- [ ] Define the bigint-aware JSON value type (`bigint` for bare integer leaves,
      `number` for decimal/exponent leaves and the exact `-0` token).
- [ ] Factor the JSON parser so number-token conversion can be supplied without
      duplicating the structural parse state machine.
- [ ] Parse bare JSON integer syntax directly to `bigint` from the tokenizer's
      exact numeric value, except exact `-0`.
- [ ] Parse exact `-0` to JavaScript negative-zero `number`.
- [ ] Parse decimal and exponent syntax to `number`.
- [ ] Add a serializer that emits `bigint` as plain decimal digits and preserves
      whole-valued `number` leaves with decimal/exponent syntax.
- [ ] Special-case `Object.is(value, -0)` so serialization emits exact `-0` and
      reparsing preserves negative zero.
- [ ] Keep the existing ordinary JSON parse/serialize API behavior unchanged.
- [ ] Add round-trip proofs for integers beyond `Number.MAX_SAFE_INTEGER`,
      negative integers, bigint zero, positive number zero, negative number zero,
      whole-valued numbers, fractions, and exponents; use `Object.is` to verify
      the `-0` case.
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
