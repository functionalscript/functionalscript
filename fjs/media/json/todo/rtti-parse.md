## RTTI-aware extended JSON parser

**Priority:** P3
**Status:** blocked
**Blocked by:** [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md)

### Problem

The extended JSON representation preserves the important runtime distinction
between bare integers (`bigint`) and decimal/exponent values (`number`), but a
plain JavaScript `number` no longer preserves the exact decimal value of its
source token.

That matters for RTTI coercion. For example:

```text
1.00000000000000001
```

is a fractional JSON number token, but JavaScript numeric conversion can round it
to the safe integer `1`. If the RTTI path first materializes that token as the
extended `number` value `1`, a later `Number.isSafeInteger` check would incorrectly
allow RTTI `bigint` and could even match the bigint const `1n`.

The JSON tokenizer already preserves the needed information in `NumberToken`:
its original `value: string` and exact decimal `bf: BigFloat`. The shared JSON
structural parse therefore needs to keep that exact numeric token available until
the domain-specific numeric policy has run.

The existing `fjs/types/rtti/parse` should remain unchanged: it parses arbitrary
runtime values and therefore correctly requires primitive runtime types to match
the schema. JSON-specific numeric conversion is a separate adapter concern.

### Proposal

Build RTTI-aware JSON on the same tokenizer and structural parser as extended
JSON, but transform the parser's exact numeric-token tree before decimal/exponent
numbers are collapsed to JavaScript `number` values:

```text
JSON text
   |
   v
JSON tokenize
   |
   v
shared structural parse with NumberToken leaves
   |                              |
   |                              +--> RTTI-directed transform -> Ts<T>
   v
extended materialization
(number | bigint leaves)
```

This is still one tokenizer and one structural parser. The exact-token tree is an
internal parse representation used only where a consumer needs information that a
JavaScript `number` cannot retain. The ordinary extended JSON API still exposes
its simple `null | boolean | string | number | bigint` leaf domain.

Do not implement the JSON-text RTTI parser as `extended parse -> RTTI transform`
when that would discard the exact `NumberToken` first. A transformer over an
already-materialized extended value may exist as a separate runtime-value helper,
but it cannot promise the same lexical validation as parsing JSON text and must
not be used to enforce the fractional-token rules below.

#### Numeric conversion

For RTTI `number`:

```text
bare integer NumberToken      -> number conversion of its exact integer value
decimal/exponent NumberToken  -> JavaScript number conversion per extended policy
```

The conversion may round or overflow because `number` is the requested target
type.

For RTTI `bigint`:

```text
bare integer token -> exact bigint (except negative zero -> 0n)
decimal/exponent token -> bigint only when BOTH:
    1. the exact NumberToken.bf value is mathematically integral; and
    2. its JavaScript number value satisfies Number.isSafeInteger(value)
```

`NumberToken.bf` is a decimal `BigFloat` `[m, e]` representing `m * 10^e`, so the
exact integrality check is deterministic:

```text
e >= 0 -> integral
 e < 0 -> integral iff m % (10 ** -e) == 0
```

Use bigint arithmetic for the power/remainder check. Only after this exact check
passes may the JavaScript `number` value participate in `Number.isSafeInteger`.
This keeps the existing safe-number coercion policy while preventing rounded
fractional input from becoming bigint.

Examples:

```text
1                    + RTTI bigint -> 1n
1.0                  + RTTI bigint -> 1n
1e3                  + RTTI bigint -> 1000n
1.00000000000000001  + RTTI bigint -> error
9007199254740992.0   + RTTI bigint -> error
-0                   + RTTI bigint -> 0n
```

For RTTI `number`, preserve negative zero where JavaScript number conversion does.
For RTTI `bigint`, exact negative zero converts to `0n` because bigint has no
negative-zero value.

Apply the same type-directed conversion before matching numeric const RTTI values.
Use `Object.is` for number consts so `0` and `-0` remain distinct. Bigint consts
compare as bigint values only after the exact-token conversion above succeeds;
thus a rounded fractional token must not match an integer bigint const.

For nonnumeric primitives, containers, optional values, and structural schemas,
follow the existing RTTI parse behavior: construct fresh containers, drop extra
struct fields/tuple elements where the current parser does, and report the same
path-oriented validation errors where practical.

For RTTI unions, classify a numeric token by the same lexical rule as extended
JSON before considering coercion: bare integer syntax prefers a bigint branch;
decimal/exponent syntax prefers a number branch. Only after an exact-category
branch fails should a numeric coercion be attempted. This preserves the extended
numeric category when the schema permits it and avoids arbitrary conversion caused
only by union branch order.

### API

Provide a typed entry point conceptually equivalent to:

```ts
parse = <T extends Type>(rtti: T) =>
    (text: string): Result<Ts<T>, JsonOrValidationError> => ...
```

The implementation may separately expose RTTI-directed transformation of an
already-materialized extended JSON value for runtime callers, but document that
such a helper cannot recover source-token precision and therefore is not
semantically identical to the JSON-text parser for fractional-to-bigint checks.

### Tasks

- [ ] Reuse the shared JSON tokenizer and structural parser while retaining
      `NumberToken` leaves in the internal exact parse representation until a
      numeric policy materializes them.
- [ ] Add the RTTI-directed transform from that exact parse representation to
      `Ts<T>`; do not route JSON text through a plain extended `number` first.
- [ ] Convert bare integer tokens exactly to bigint when RTTI requires `bigint`.
- [ ] For decimal/exponent tokens targeting RTTI `bigint`, check exact
      `NumberToken.bf` integrality before JavaScript number conversion, then
      require `Number.isSafeInteger` before converting to bigint.
- [ ] Prove that fractional tokens that round to integers, including
      `1.00000000000000001`, are rejected for RTTI `bigint` and bigint consts.
- [ ] Convert numeric tokens to JavaScript `number` when RTTI requires `number`,
      accepting the target type's normal rounding/overflow policy.
- [ ] Handle `-0` explicitly: preserve it for RTTI `number`; convert it to `0n`
      only when RTTI requires `bigint`.
- [ ] Apply exact-token numeric conversion before numeric const matching; preserve
      `Object.is` semantics for number consts.
- [ ] Preserve current RTTI parser container behavior and useful validation paths.
- [ ] Define deterministic union handling that prefers the token's extended
      lexical category before numeric coercion.
- [ ] If exposing a transformer for already-materialized extended values, document
      that it cannot provide the JSON-text parser's exact fractional-token
      validation.
- [ ] Add proof coverage for integer JSON into RTTI `number`, decimal/exponent
      JSON into RTTI `bigint`, safe/unsafe conversions, rounded fractional tokens,
      numeric consts, `0`/`-0`, unions, and nested containers.
- [ ] `npx tsc`, `fjs test`.

### Related

- [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md) — owns the
  shared tokenizer/structural parse path, exact numeric-token intermediate, and
  extended runtime materialization.
- [Standard JSON transformer](./standard-transform.md) — alternative policy layer
  that removes bigint for standard JSON compatibility.
- [`fjs/media/json/tokenizer/module.f.ts`](../tokenizer/module.f.ts) — currently
  exposes `NumberToken` with both the source `value` and exact decimal `bf` used
  by this design.
- [`fjs/types/rtti/parse`](../../../types/rtti/parse/module.f.ts) — existing strict
  runtime-value parser whose structural behavior should be reused where possible,
  not changed to add JSON-specific coercion.
- [RTTI serializable data representation](../../../types/rtti/todo/serializable-data.md)
  — a future data-driven RTTI parser can support the same JSON numeric conversion
  policy.
