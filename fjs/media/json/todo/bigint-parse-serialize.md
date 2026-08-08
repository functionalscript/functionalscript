## Parse and serialize extended JSON integers as bigint

**Priority:** P3
**Status:** blocked
**Blocked by:** [JSON numeric edge cases](./number-edge-cases.md)

### Problem

Native JavaScript JSON handling materializes every JSON number as a `number`.
Large integer literals therefore lose precision even though JSON syntax itself
does not impose the IEEE-754 safe-integer limit.

We need a schema-neutral intermediate JSON representation that preserves bare
integers exactly as `bigint`. Higher-level policies can then transform that value
into ordinary JSON values, RTTI-directed values, DJS values, or other domains
without duplicating the JSON tokenizer and structural parser.

In particular, BNF data will need this once its symbols and terminal ranges move
from `number` to `bigint`.

### Extended JSON value

Define an extended JSON tree with the same object/array structure as ordinary
JSON, but with `bigint` added to the primitive leaf set:

```text
ExtendedPrimitive = null | boolean | string | number | bigint
ExtendedUnknown   = ExtendedPrimitive | ExtendedObject | ExtendedArray
```

This is an intermediate runtime representation. Its serialized form is still
ordinary valid JSON text; there is no `123n` syntax, tagged object, or quoted
integer convention.

### Parse

Use the JSON number token's lexical form:

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
remains a JavaScript `number` to preserve the information present in the JSON
text. Fraction or exponent syntax also becomes a JavaScript `number`.

Reuse the tokenizer's exact numeric representation for bare integers rather than
converting them through `number` first.

Exponent syntax can overflow the JavaScript `number` domain even though the JSON
text is valid; for example, `1e400` may materialize as `Infinity` under a direct
number conversion. The representation and serialization/failure behavior for
such inputs must be settled by [JSON numeric edge cases](./number-edge-cases.md)
before this parse/serialize task is implemented.

### Serialize

For finite values whose behavior is already settled, serialize according to the
runtime type of the extended numeric leaf:

- `bigint` -> ordinary decimal JSON integer syntax, without an `n` suffix;
- finite `number` -> JSON number syntax;
- a finite whole-valued `number` other than `-0` -> a non-integer lexical form
  such as `3.0`, so reparsing returns `number` rather than `bigint`;
- `-0` -> exact JSON token `-0`, detected with `Object.is(value, -0)`.

This gives a one-to-one mapping for the settled finite extended values:

```text
0n -> 0    -> 0n
0  -> 0.0  -> 0
-0 -> -0   -> -0
3n -> 3    -> 3n
3  -> 3.0  -> 3
```

The `.0` form is correct for the **extended** representation because it preserves
whether the runtime leaf is `number` or `bigint`. A separate standard-JSON
transformer canonicalizes safe whole-valued JavaScript numbers to `bigint`
before serialization, so normal standard JSON values still produce `[1,2,3]`
rather than `[1.0,2.0,3.0]`.

Do not settle non-finite values here. `NaN`, `Infinity`, `-Infinity`, including
non-finite results produced by parsing valid exponent syntax, and their
interaction with standard compatibility are covered by the blocking
[number edge-case investigation](./number-edge-cases.md).

### Architecture

Keep this layer policy-free:

```text
JSON text
   |
   v
extended JSON parse
   |
   +--> standard JSON transformer
   |
   +--> RTTI-aware transformer
   |
   +--> future domain-specific transformers
```

The tokenizer and structural JSON parser should exist once. The standard JSON and
RTTI-aware surfaces are transformations on top of the extended value rather than
separate JSON parsers.

If the generic JSON/DJS tree type lands first, use it for the shared recursive
container shape and vary only the primitive leaf type.

### Tasks

- [ ] Define the extended JSON value type with `bigint` added to the JSON leaf
      set.
- [ ] Factor the JSON parser so number-token conversion can produce the extended
      numeric leaves without duplicating the structural parse state machine.
- [ ] Parse bare JSON integer syntax directly to `bigint`, except exact `-0`.
- [ ] Parse exact `-0` to JavaScript negative-zero `number`.
- [ ] Parse decimal and exponent syntax according to the numeric-edge policy,
      including values such as `1e400` that overflow finite JavaScript `number`.
- [ ] Add the extended serializer with the settled numeric rules above and the
      non-finite policy chosen by the blocking numeric-edge task.
- [ ] Add round-trip/error proofs for integers beyond `Number.MAX_SAFE_INTEGER`,
      negative integers, bigint zero, positive number zero, negative number zero,
      whole-valued numbers, fractions, ordinary exponents, and overflowed
      exponents; use `Object.is` for `-0`.
- [ ] Document that the serialized output is valid JSON but native JavaScript
      `JSON.parse` may lose precision when consuming large integer literals.
- [ ] `npx tsc`, `fjs test`.

### Related

- [JSON numeric edge cases](./number-edge-cases.md) — **blocks this task** until
  non-finite and exponent-overflow behavior is decided.
- [Standard JSON transformer](./standard-transform.md) — converts between the
  extended value and the ordinary bigint-free JSON value domain and composes the
  standard parser/stringifier on top of this layer.
- [RTTI-aware extended JSON parser](./rtti-parse.md) — transforms the extended
  numeric leaves according to a requested RTTI schema.
- [BNF bigint symbols](../../../bnf/todo/bigint-symbols.md) — consumes this
  representation so bigint-valued BNF data remains JSON-serializable.
- [`fjs/djs/todo/json-bigint-serialization.md`](../../../djs/todo/json-bigint-serialization.md)
  — DJS-specific JSON interchange should build on this extended representation.
- [Generic JSON/DJS tree type](../../../djs/todo/663-json-djs-tree-type.md) — may
  provide the shared recursive tree shape.
- [Integer literal `123` is a `bigint`](../../../../todo/blocked/integer-as-bigint.md)
  — broader language-level bigint-literal direction; this task is only a JSON
  representation.
