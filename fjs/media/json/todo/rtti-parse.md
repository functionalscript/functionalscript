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

The prerequisite has shipped: the reader hands every number's exact lexeme to
the codec's `NumberPolicy` and derives nothing from it first
([Losslessness starts at the grammar](../README.md#losslessness-starts-at-the-grammar)),
so the lexeme is the canonical exact source for schema-directed validation, and
the bounded lexical helpers such validation needs — `numberLexeme`,
`isBareInteger`, `isIntegral` — ship in
[`number/module.f.mjs`](../number/module.f.mjs).

The existing `fjs/rtti/parse` should remain unchanged: it parses arbitrary
runtime values and therefore correctly requires primitive runtime types to match
the schema. JSON-specific numeric conversion is a separate adapter concern.

### Proposal

Build RTTI-aware JSON on the same grammar reader as extended JSON, reading each
number's lexeme before it is narrowed to a runtime value
([the numeric policy is the seam](../README.md#the-numeric-policy-is-the-seam-not-an-exact-tree)):

```text
JSON text
   |
   v
grammar reader (fjs/media/json/parser), every number's lexeme intact
   |                              |
   |                              +--> RTTI-directed reading -> Ts<T>
   v
extended NumberPolicy
(number | bigint leaves)
```

This is still one grammar and one reader. The ordinary extended JSON API still
exposes its simple `null | boolean | string | number | bigint` leaf domain.

Do not implement the JSON-text RTTI parser as `extended parse -> RTTI transform`
when that would narrow the lexeme first. A transformer over an
already-materialized extended value may exist as a separate runtime-value helper,
but it cannot promise the same lexical validation as parsing JSON text.

#### Numeric conversion

For RTTI `number`:

```text
bare integer lexeme      -> JavaScript number conversion of its exact text
decimal/exponent lexeme  -> JavaScript number conversion per extended policy
```

The conversion may round or overflow because `number` is the requested target
type.

For RTTI `bigint`, a bare integer beyond the runtime's own bigint limit throws
inside `BigInt`, and FunctionalScript has no `try`/`catch` to turn that into a
`Result`. This parser inherits the codec's
[documented limit](../README.md#one-documented-limit)
([number-edge-cases](./number-edge-cases.md#known-limit-oversized-bare-integers)):
a `tryBigInt`-shaped helper becomes possible only if FunctionalScript gains a
fallible-call primitive, and predicting the failure from a digit count is the
preflight [DESIGN.md §6](../../../../doc/DESIGN.md#6-never-precompute-a-size-to-predict-whether-something-fits)
rules out.

Then apply these rules:

```text
bare integer lexeme -> exact bigint materialization
exact -0            -> 0n
decimal/exponent lexeme -> bigint only when BOTH:
    1. the lexeme is mathematically integral; and
    2. Number(lexeme) satisfies Number.isSafeInteger(...)
```

For a decimal/exponent lexeme, the first test must be lexical and input-bounded:
`isIntegral` in [`number/module.f.mjs`](../number/module.f.mjs) is that test,
reading the coefficient, fraction and exponent text in the length of the token,
so `1e-99999999999999999999` is recognized as fractional without overflowing an
exponent variable or evaluating an enormous `10 ** exponent` expression.

Only after exact lexical integrality succeeds should the implementation materialize
`Number(lexeme)` and apply `Number.isSafeInteger`. If that succeeds, the
resulting safe integer can be converted to bigint without a magnitude problem.

Examples:

```text
1                    + RTTI bigint -> 1n
1.0                  + RTTI bigint -> 1n
1e3                  + RTTI bigint -> 1000n
1.00000000000000001  + RTTI bigint -> error
1e-99999999999999999999 + RTTI bigint -> error
9007199254740992.0   + RTTI bigint -> error
<bare integer beyond runtime bigint limit> + RTTI bigint -> throws (the documented limit)
-0                   + RTTI bigint -> 0n
```

For RTTI `number`, preserve negative zero where JavaScript number conversion does.
For RTTI `bigint`, exact negative zero converts to `0n` because bigint has no
negative-zero value.

Apply the same type-directed conversion before matching numeric const RTTI values.
Use `Object.is` for number consts so `0` and `-0` remain distinct. Bigint consts
compare as bigint values only after the exact-lexeme conversion above succeeds;
thus a rounded fractional token must not accidentally match an integer bigint
const.

For nonnumeric primitives, containers, optional values, and structural schemas,
follow the existing RTTI parse behavior: construct fresh containers, drop extra
struct fields/tuple elements where the current parser does, and report the same
path-oriented validation errors where practical.

For RTTI unions, classify a numeric token by the same lexical rule as extended
JSON before considering coercion: bare integer syntax prefers a bigint branch;
decimal/exponent syntax prefers a number branch. Only after an exact-category
branch fails should a numeric coercion be attempted.

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

- [ ] Read JSON text through the shared grammar reader, taking each number's
      lexeme as the canonical exact representation for schema-directed numeric
      validation.
- [ ] Add the RTTI-directed reading from that lexeme to `Ts<T>`; do not route
      JSON text through a plain extended `number` first.
- [ ] For decimal/exponent lexemes targeting RTTI `bigint`, use `isIntegral`
      before JavaScript number conversion, then require `Number.isSafeInteger`
      before converting to bigint.
- [ ] Prove that fractional tokens that round to integers, including
      `1.00000000000000001`, are rejected for RTTI `bigint` and bigint consts.
- [ ] Prove that extremely large positive/negative exponent text is handled in
      O(input length), does not throw, and follows the exact lexical integrality
      rule before safe-number conversion.
- [ ] Convert numeric tokens to JavaScript `number` when RTTI requires `number`,
      accepting the target type's normal rounding/overflow policy.
- [ ] Handle `-0` explicitly: preserve it for RTTI `number`; convert it to `0n`
      only when RTTI requires `bigint`.
- [ ] Apply exact-lexeme numeric conversion before numeric const matching; preserve
      `Object.is` semantics for number consts.
- [ ] Preserve current RTTI parser container behavior and useful validation paths.
- [ ] Define deterministic union handling that prefers the token's extended
      lexical category before numeric coercion.
- [ ] If exposing a transformer for already-materialized extended values, document
      that it cannot provide the JSON-text parser's exact fractional-token
      validation.
- [ ] Add proof coverage for integer JSON into RTTI `number`, decimal/exponent
      JSON into RTTI `bigint`, safe/unsafe conversions, rounded fractional tokens,
      unbounded exponent text, numeric consts, `0`/`-0`,
      unions, and nested containers.
- [ ] `tsc`, `fjs test`.

### Related

- [`fjs/media/json/README.md`](../README.md) — the shipped grammar reader, its
  numeric-policy seam, and the extended runtime materialization this parser
  reuses.
- [`fjs/media/json/number/module.f.mjs`](../number/module.f.mjs) — the bounded
  lexical helpers (`isBareInteger`, `isIntegral`) for exact checks on a token
  before it is narrowed.
- [Standard JSON transformer](./standard-transform.md) — runtime value conversion
  between already-materialized extended and ordinary JSON trees.
- [Losslessness starts at the grammar](../README.md#losslessness-starts-at-the-grammar)
  — the reader hands the policy the numeric lexeme, never a derived value, so
  nothing is narrowed before the policy asks.
- [`fjs/rtti/parse`](../../../rtti/parse/module.f.mjs) — existing strict
  runtime-value parser whose structural behavior should be reused where possible,
  not changed to add JSON-specific coercion.
- [`fjs/rtti/README.md`](../../../rtti/README.md) — the schema-form
  `validate` has been deleted, which makes this parser the answer for callers
  reading JSON text against a schema rather than a convenience. Structs and
  tuples are **closed** there, so the "drop extra struct fields/tuple elements
  where the current parser does" behavior this task inherits is what `open(c)`
  now buys rather than what a bare schema gives: a bare one *errors* on an
  undeclared member instead.
- [Open containers](../../../rtti/README.md#open-containers) — `open(c)`
  and `rest(c, r)`, which have shipped. A stated `rest` holds an undeclared
  member to that rest without carrying it into what `parse` builds, so this
  parser needs that case too — alongside the closed default's rejection.
- [RTTI serializable data form](../../../rtti/data/README.md)
  — a future data-driven RTTI parser can support the same JSON numeric conversion
  policy.
