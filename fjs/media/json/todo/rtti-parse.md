## RTTI-aware extended JSON parser

**Priority:** P3
**Status:** open

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

The JSON numeric tokenization path must therefore preserve the original lexeme in
`NumberToken.value` before any potentially unrepresentable derived numeric value
is built. This is a prerequisite owned by the extended-JSON task: the current
tokenizer eagerly accumulates coefficient digits in bigint and exponent digits in
JavaScript `number`, so retaining the token only in the structural parser is too
late for coefficients/exponents beyond those runtime representations.

Once that tokenizer boundary is lossless, `NumberToken.value` is the canonical
exact source for schema-directed validation. `NumberToken.bf` may be useful when
available, but it is not required to exist or be exact for every valid JSON token.
The shared JSON structural parse keeps the complete token available until the
domain-specific numeric policy has run.

The existing `fjs/types/rtti/parse` should remain unchanged: it parses arbitrary
runtime values and therefore correctly requires primitive runtime types to match
the schema. JSON-specific numeric conversion is a separate adapter concern.

### Proposal

Build RTTI-aware JSON on the same tokenizer and structural parser as extended
JSON, but transform the parser's token-preserving numeric tree before
numbers are collapsed to runtime numeric values:

```text
JSON text
   |
   v
lossless JSON numeric tokenization
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
but it cannot promise the same lexical validation as parsing JSON text.

#### Numeric conversion

For RTTI `number`:

```text
bare integer NumberToken      -> JavaScript number conversion of its exact text
decimal/exponent NumberToken  -> JavaScript number conversion per extended policy
```

The conversion may round or overflow because `number` is the requested target
type.

For RTTI `bigint`, all runtime bigint creation must be **fallible**. Conceptually,
use a helper such as:

```text
tryBigInt(NumberToken.value) -> bigint | null
```

The exact helper/API name is not important. Its contract is: branch on whether
the actual runtime bigint construction succeeds; do not predict success from a
coefficient digit count and do not let a runtime size exception escape. If an
otherwise-valid integer cannot be represented by the runtime bigint type, the
RTTI JSON parser returns its normal validation/error `Result` rather than
panicking.

Then apply these rules:

```text
bare integer token -> try exact bigint materialization
                      null -> validation error
                      bigint -> success
exact -0           -> 0n
decimal/exponent token -> bigint only when BOTH:
    1. the exact token text is mathematically integral; and
    2. Number(token.value) satisfies Number.isSafeInteger(...)
```

For a decimal/exponent token, the first test must be lexical and input-bounded.
Do not use `NumberToken.bf` as the source of truth for an arbitrary exponent and
do not compute a power proportional to the exponent magnitude.

Parse `NumberToken.value` into coefficient digits, fraction-digit count, and the
optional exponent sign/digit text. Let `z` be the number of trailing zeros in the
coefficient. Then determine whether the decimal shift leaves a fractional part by
comparing the exponent text with the small counts already bounded by token length:

- zero coefficient is integral for every exponent;
- positive exponent: if the exponent is at least the fraction-digit count, the
  value is integral; otherwise the coefficient must contain enough trailing zeros
  for the remaining fractional digits;
- negative exponent: the coefficient must contain enough trailing zeros for the
  fraction digits plus the exponent magnitude.

Exponent digit text may be arbitrarily long. Compare its magnitude to bounded
counts by decimal-string length/lexicographic comparison first. Only convert it
to an ordinary integer after proving the relevant magnitude is no greater than a
count bounded by the token length. Thus `1e-99999999999999999999` is recognized
as fractional and rejected without overflowing an exponent variable or evaluating
an enormous `10 ** exponent` expression.

Only after exact lexical integrality succeeds should the implementation materialize
`Number(token.value)` and apply `Number.isSafeInteger`. If that succeeds, the
resulting safe integer can be converted to bigint without a magnitude problem.

Examples:

```text
1                    + RTTI bigint -> 1n
1.0                  + RTTI bigint -> 1n
1e3                  + RTTI bigint -> 1000n
1.00000000000000001  + RTTI bigint -> error
1e-99999999999999999999 + RTTI bigint -> error
9007199254740992.0   + RTTI bigint -> error
<bare integer beyond runtime bigint limit> + RTTI bigint -> error
-0                   + RTTI bigint -> 0n
```

For RTTI `number`, preserve negative zero where JavaScript number conversion does.
For RTTI `bigint`, exact negative zero converts to `0n` because bigint has no
negative-zero value.

Apply the same type-directed conversion before matching numeric const RTTI values.
Use `Object.is` for number consts so `0` and `-0` remain distinct. Bigint consts
compare as bigint values only after the exact-token conversion above succeeds;
thus a rounded fractional token or an unrepresentable oversized integer must not
panic or accidentally match an integer bigint const.

For nonnumeric primitives, containers, optional values, and structural schemas,
follow the existing RTTI parse behavior: construct fresh containers, drop extra
struct fields/tuple elements where the current parser does, and report the same
path-oriented validation errors where practical.

For RTTI unions, classify a numeric token by the same lexical rule as extended
JSON before considering coercion: bare integer syntax prefers a bigint branch;
decimal/exponent syntax prefers a number branch. Only after an exact-category
branch fails should a numeric coercion be attempted. A failure to materialize an
oversized bigint is an ordinary branch failure/error, not an exception escaping
the `Result` API.

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

- [ ] Reuse the shared lossless JSON tokenizer and structural parser while
      retaining `NumberToken` leaves until a numeric policy materializes them.
- [ ] Treat `NumberToken.value`, not a mandatory `NumberToken.bf`, as the canonical
      exact representation for schema-directed numeric validation.
- [ ] Add the RTTI-directed transform from that exact parse representation to
      `Ts<T>`; do not route JSON text through a plain extended `number` first.
- [ ] Materialize bare integer tokens for RTTI `bigint` through a fallible helper
      that returns an ordinary failure when runtime bigint construction is not
      possible; do not preflight by digit length and do not leak a runtime throw.
- [ ] For decimal/exponent tokens targeting RTTI `bigint`, use a bounded lexical
      integrality check over coefficient/fraction/exponent text before JavaScript
      number conversion, then require `Number.isSafeInteger` before converting to
      bigint.
- [ ] Do not parse an unbounded exponent into JavaScript `number` for exact
      validation and do not compute a bigint power proportional to exponent
      magnitude merely to decide integrality.
- [ ] Prove that fractional tokens that round to integers, including
      `1.00000000000000001`, are rejected for RTTI `bigint` and bigint consts.
- [ ] Prove that extremely large positive/negative exponent text is handled in
      O(input length), does not throw, and follows the exact lexical integrality
      rule before safe-number conversion.
- [ ] Prove that a syntactically valid bare integer beyond the runtime bigint
      magnitude returns a validation/error `Result` for RTTI `bigint` rather than
      throwing.
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
      oversized bare integers, unbounded exponent text, numeric consts, `0`/`-0`,
      unions, and nested containers.
- [ ] `npx tsc`, `fjs test`.

### Related

- [`fjs/media/json/README.md`](../README.md) — the shipped lossless tokenizer,
  the shared structural parse and its numeric-policy seam, and the extended
  runtime materialization this parser reuses.
- [`fjs/media/json/number/module.f.mjs`](../number/module.f.mjs) — the bounded
  lexical helpers (`isBareInteger`, `isIntegral`) for exact checks on a token
  before it is narrowed.
- [Standard JSON transformer](./standard-transform.md) — runtime value conversion
  between already-materialized extended and ordinary JSON trees.
- [`fjs/media/json/tokenizer/module.f.mjs`](../tokenizer/module.f.mjs) — JSON token
  production must preserve the numeric lexeme before any unrepresentable derived
  numeric construction.
- [`fjs/types/rtti/parse`](../../../types/rtti/parse/module.f.mjs) — existing strict
  runtime-value parser whose structural behavior should be reused where possible,
  not changed to add JSON-specific coercion.
- [`fjs/types/rtti/README.md`](../../../types/rtti/README.md) — the schema-form
  `validate` has been deleted, which makes this parser the answer for callers
  reading JSON text against a schema rather than a convenience. Structs and
  tuples are open there, matching the "drop extra struct fields/tuple elements
  where the current parser does" behavior this task already inherits.
- [Closed containers](../../../types/rtti/README.md#closed-containers) — the
  closed container schema, which has shipped. A closed container *errors* on an
  undeclared member rather than dropping it, and holds one matching a stated
  `rest` to that `rest` without carrying it into what `parse` builds, so this
  parser needs that case too.
- [RTTI serializable data form](../../../types/rtti/data/README.md)
  — a future data-driven RTTI parser can support the same JSON numeric conversion
  policy.
