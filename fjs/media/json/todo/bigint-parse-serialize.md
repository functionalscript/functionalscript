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
into ordinary JSON values, DJS values, or other domains without duplicating the
JSON tokenizer and structural parser.

Some schema-directed consumers need exact numeric information before a
decimal/exponent token is materialized as JavaScript `number`. For example,
`1.00000000000000001` may round to `1`, so an RTTI bigint validator cannot
distinguish it from an integer if it sees only the final number.

The existing tokenizer already preserves the original number lexeme as
`NumberToken.value`. It also carries `NumberToken.bf`, which is useful for normal
numeric conversion but is **not** an exact representation for every valid JSON
number: the tokenizer currently accumulates exponent digits in a JavaScript
`number`, so an arbitrarily long exponent can lose precision or become infinite.
Exact policies must therefore treat `NumberToken.value` as the source of truth
and must not assume `NumberToken.bf` is exact for unbounded exponent syntax.

Therefore the structural parser should retain `NumberToken` leaves in an internal
lossless parse representation and let each numeric policy materialize those
leaves. The public extended JSON value remains simple; the token-preserving
representation is an internal shared substrate, not a new JSON syntax or public
numeric type.

In particular, BNF data will need the extended runtime representation once its
symbols and terminal ranges move from `number` to `bigint`.

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

### Shared lossless structural parse

Factor the current JSON structural parser so it can preserve numeric tokens before
runtime numeric materialization. Conceptually, its internal tree has ordinary
JSON container structure and `NumberToken` numeric leaves:

```text
ExactPrimitive = null | boolean | string | NumberToken
ExactUnknown   = ExactPrimitive | ExactObject | ExactArray
```

The exact representation need not become a public API. It exists so the tokenizer
and structural state machine are implemented once while consumers that require
exact decimal syntax can inspect `NumberToken.value` before JavaScript number
rounding occurs.

`NumberToken.bf` may still be reused where its exponent is representable by the
current tokenizer implementation, but it is a derived convenience, not the
canonical exact representation. Policies that must be correct for every valid
JSON number must operate from `NumberToken.value` or another representation that
preserves the exponent digits without first narrowing them to JavaScript
`number`.

Extended JSON materialization converts this exact tree to `ExtendedUnknown` using
the lexical rules below. Standard FunctionalScript JSON and RTTI-aware JSON may
transform the same exact tree directly because their runtime numeric policies are
different. In particular, a valid bare integer can exceed the runtime bigint
construction limit, so the ordinary bigint-free parser must not be forced to
materialize `ExtendedUnknown` first.

### Parse

Use the JSON number token's lexical form when materializing extended JSON:

```text
123       -> 123n
-123      -> -123n
0         -> 0n
-0        -> -0 as number
1.5       -> 1.5
1e3       -> 1000 as number
1E3       -> 1000 as number
1.0       -> 1 as number
```

A number token with no decimal point and no exponent becomes a `bigint`, except
for the exact token `-0`. JavaScript `bigint` has no negative-zero value, so `-0`
remains a JavaScript `number` to preserve the information present in the JSON
text.

The distinction is lexical, not mathematical: **any JSON number token containing
a decimal point or exponent marker (`e` / `E`) is a floating-point `number`, even
when its mathematical value is an integer.** For example, `1e3` is `number`
`1000`, not `1000n`.

Parse bare integer syntax directly from the token text rather than converting it
through `number` first. Keep the complete `NumberToken.value` available to
schema-directed consumers until their numeric validation has run.

Exponent syntax can overflow the JavaScript `number` domain even though the JSON
text is valid; for example, `1e400` may materialize as `Infinity` under a direct
number conversion. The representation and serialization/failure behavior for
such inputs must be settled by [JSON numeric edge cases](./number-edge-cases.md)
before this parse/serialize task is implemented.

#### Exact checks with unbounded exponents

Exact schema-directed checks must not convert an arbitrary exponent to JavaScript
`number`, and must not evaluate a power such as `10 ** exponent` merely to decide
whether a token is integral.

Use a lexical, input-bounded check instead. Parse `NumberToken.value` into:

- coefficient digits (integer digits plus fraction digits);
- the count of fraction digits;
- exponent sign and exponent digit text, if present.

For integrality, only the decimal shift relative to the coefficient's available
trailing zeros matters. Compare the exponent digit text against small counts such
as the fraction-digit count and coefficient length. Convert the exponent to an
ordinary integer only after proving its magnitude is bounded by the token length;
otherwise the result can already be decided from the comparison. A huge negative
exponent on a nonzero coefficient is therefore rejected as fractional without
constructing a huge power or bigint, while a huge positive exponent can be known
to be mathematically integral before ordinary JavaScript-number conversion later
rejects it if it is not a safe finite target value.

The zero coefficient is a special simple case: it is mathematically integral for
any exponent magnitude.

This keeps exact validation O(input length) and makes valid inputs such as
`1e-99999999999999999999` fail normally where appropriate instead of overflowing
an internal exponent representation or triggering enormous exponentiation.

### Serialize

For finite values whose behavior is already settled, serialize according to the
runtime type of the extended numeric leaf:

- `bigint` -> canonical base-10 JSON integer syntax, without an `n` suffix and
  **never using exponent (`e` / `E`) notation**;
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

A `bigint` is always serialized as its full decimal integer digits. Even a very
large bigint is never shortened to exponent notation, because exponent syntax is
reserved for the `number` side of the extended representation and would parse
back as `number` rather than `bigint`.

The `.0` form is correct for the **extended** representation because it preserves
whether the runtime leaf is `number` or `bigint`. It is not a requirement for the
ordinary FunctionalScript JSON serializer, which owns a separate standard-number
formatting policy and does not have to route every value through the extended
serializer.

Do not settle non-finite values here. `NaN`, `Infinity`, `-Infinity`, including
non-finite results produced by parsing valid exponent syntax, are covered by the
blocking [number edge-case investigation](./number-edge-cases.md). Native
`JSON.*` compatibility is optional and belongs to the separate standard-codec
TODO rather than this extended representation.

### Architecture

Keep the tokenizer and structural parser single-source while retaining lossless
numeric syntax until each consumer applies its own numeric policy:

```text
JSON text
   |
   v
JSON tokenizer
   |
   v
shared structural parse
(NumberToken numeric leaves; value is canonical exact lexeme)
   |
   +--> extended materialization -> ExtendedUnknown
   |         |
   |         +--> runtime extended/standard value transforms
   |         +--> DJS / other runtime-value consumers
   |
   +--> standard materialization -> json.Unknown
   |
   +--> RTTI-aware transform -> Ts<T>
   |
   +--> optional native-compatible materialization
```

The ordinary standard parser is therefore not required to pass through
`ExtendedUnknown`. The runtime transformer remains useful when a caller already
has an extended value, but text parsing can materialize the bigint-free value
directly from the same exact tree. RTTI likewise consumes the token-preserving
structural parse before decimal/exponent tokens are rounded to plain JavaScript
numbers.

This keeps one tokenizer and one structural parser while avoiding artificial
coupling between numeric policies.

If the generic JSON/DJS tree type lands first, use it for both the exact and
extended recursive container shapes and vary only the primitive leaf type. That
reuse is conditional on the generic object's index signature being optional:

```ts
type Object<P> = { readonly [k in string]?: Unknown<P> }
```

A required index signature is not sound here because an arbitrary missing object
property evaluates to `undefined`, while `undefined` is not an extended JSON leaf.
Do not adopt a shared `Tree.Object<P>` that types every string key as present.
The generic-tree TODO owns this requirement.

### Tasks

- [ ] Define the extended JSON value type with `bigint` added to the JSON leaf
      set.
- [ ] If reusing the generic JSON/DJS tree type, require its object shape to use
      the optional recursive index signature
      `{ readonly [k in string]?: Unknown<P> }`; do not reuse a required index
      signature.
- [ ] Factor the JSON parser so the shared structural parse retains `NumberToken`
      numeric leaves before runtime numeric materialization; do not duplicate the
      structural parse state machine for extended/standard/RTTI consumers.
- [ ] Treat `NumberToken.value` as the canonical lossless numeric source. Do not
      assume `NumberToken.bf` remains exact after an arbitrarily long exponent.
- [ ] Materialize extended JSON from that exact tree using the lexical numeric
      rules in this task.
- [ ] Keep the exact structural tree reusable by the ordinary standard materializer
      so standard JSON parsing does not require successful intermediate bigint
      construction.
- [ ] Add a bounded lexical helper for exact decimal/exponent properties needed by
      schema-directed consumers; it must not narrow an unbounded exponent before
      deciding whether the exponent magnitude matters.
- [ ] Ensure exact integrality checks never compute `10 ** hugeExponent` or an
      equivalent enormous bigint power merely to reject a token.
- [ ] Parse bare JSON integer syntax directly to `bigint`, except exact `-0`.
- [ ] Parse exact `-0` to JavaScript negative-zero `number`.
- [ ] Parse every number token containing `.` or `e` / `E` as `number`, even when
      the resulting numeric value is mathematically integral.
- [ ] Parse decimal and exponent syntax according to the numeric-edge policy,
      including values such as `1e400` that overflow finite JavaScript `number`.
- [ ] Serialize every `bigint` as canonical full base-10 integer digits and never
      use exponent notation.
- [ ] Add the extended serializer with the settled numeric rules above and the
      non-finite policy chosen by the blocking numeric-edge task.
- [ ] Add round-trip/error proofs for integers beyond `Number.MAX_SAFE_INTEGER`,
      negative integers, bigint zero, positive number zero, negative number zero,
      whole-valued numbers, fractions, ordinary exponents, overflowed exponents,
      oversized bare integers, and exponent text far beyond JavaScript-number
      precision; explicitly prove that exact checks remain bounded by input length
      and do not throw.
- [ ] Document that the serialized output is valid JSON but ordinary JavaScript
      consumers may choose a different runtime numeric representation.
- [ ] `npx tsc`, `fjs test`.

### Related

- [JSON numeric edge cases](./number-edge-cases.md) — **blocks this task** until
  extended non-finite, exponent-overflow, and oversized-bigint behavior is decided.
- [Standard JSON parse/serialize](./standard-parse-serialize.md) — reuses the same
  exact structural parse but materializes the ordinary bigint-free JSON domain
  directly; optional native compatibility lives there too.
- [Standard/extended value transforms](./standard-transform.md) — converts between
  already-materialized extended and ordinary runtime value trees; it does not own
  parser/stringifier composition.
- [RTTI-aware extended JSON parser](./rtti-parse.md) — reuses the same lossless
  structural parse so fractional-token validation occurs before JavaScript
  number rounding.
- [BNF bigint symbols](../../../bnf/todo/bigint-symbols.md) — consumes the extended
  runtime representation so bigint-valued BNF data remains JSON-serializable.
- [`fjs/djs/todo/json-bigint-serialization.md`](../../../djs/todo/json-bigint-serialization.md)
  — DJS-specific JSON interchange should build on this extended representation.
- [Generic JSON/DJS tree type](../../../djs/todo/663-json-djs-tree-type.md) — may
  provide the shared recursive tree shape; its object index signature must be
  optional before this task reuses it.
- [Integer literal `123` is a `bigint`](../../../../todo/blocked/integer-as-bigint.md)
  — broader language-level bigint-literal direction; this task is only a JSON
  representation.
