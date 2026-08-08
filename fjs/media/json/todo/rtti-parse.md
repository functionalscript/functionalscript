## RTTI-aware extended JSON parser

**Priority:** P3
**Status:** blocked
**Blocked by:** [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md)

### Problem

The extended JSON parser preserves numeric syntax before a domain type is known:
bare integers become `bigint`, decimal/exponent values become `number`, and exact
`-0` remains negative-zero `number`.

That representation is intentionally schema-neutral. Once RTTI is available, a
caller should be able to parse the same JSON text directly into the value type
required by the RTTI schema instead of first collapsing all integers to standard
JavaScript `number` values.

The existing `fjs/types/rtti/parse` should remain unchanged: it parses arbitrary
runtime values and therefore correctly requires primitive runtime types to match
the schema. JSON-specific numeric conversion is a separate adapter concern.

### Proposal

Add an RTTI-aware JSON parser built on the extended JSON parser:

```text
JSON text -> extended JSON parse -> RTTI-directed transform -> Ts<T>
```

The RTTI-directed transform recursively rebuilds arrays/records/tuples/structs in
the same spirit as `fjs/types/rtti/parse`, but numeric leaves may be converted to
the type requested by the schema.

#### Numeric conversion

For RTTI `number`:

```text
extended number -> unchanged
extended bigint -> Number(value)
```

The `bigint -> number` conversion may round or overflow because `number` is the
requested target type.

For RTTI `bigint`:

```text
extended bigint -> unchanged
extended number -> BigInt(value), only when Number.isSafeInteger(value)
```

This includes `-0 -> 0n` when RTTI explicitly requires `bigint`. Reject
fractional, non-finite, and unsafe-integer `number` values instead of silently
creating a bigint from a value whose exact decimal integer may already have been
lost during number parsing.

Apply the same type-directed conversion before matching numeric const RTTI values.
Use `Object.is` for number consts so `0` and `-0` remain distinct. Bigint consts
compare as bigint values after exact conversion.

For nonnumeric primitives, containers, optional values, and structural schemas,
follow the existing RTTI parse behavior: construct fresh containers, drop extra
struct fields/tuple elements where the current parser does, and report the same
path-oriented validation errors where practical.

For RTTI unions, prefer a branch that accepts the extended numeric value without
conversion before trying a numeric coercion. This preserves the intermediate
numeric type when the schema permits it and avoids arbitrary conversion caused
only by union branch order.

### API

Provide a typed entry point conceptually equivalent to:

```ts
parse = <T extends Type>(rtti: T) =>
    (text: string): Result<Ts<T>, JsonOrValidationError> => ...
```

The implementation may also expose the RTTI-directed transformation of an
already-parsed extended JSON value separately so callers that parse once can
reuse the value with multiple schemas.

### Tasks

- [ ] Add an RTTI-directed transformer from extended JSON values to `Ts<T>`.
- [ ] Add the composed JSON-text parser using extended parse + RTTI transform.
- [ ] Convert `bigint -> number` when RTTI requires `number`.
- [ ] Convert `number -> bigint` only for `Number.isSafeInteger` values.
- [ ] Handle `-0` explicitly: preserve it for RTTI `number`; convert it to `0n`
      only when RTTI requires `bigint`.
- [ ] Apply numeric conversion before numeric const matching; preserve `Object.is`
      semantics for number consts.
- [ ] Preserve current RTTI parser container behavior and useful validation paths.
- [ ] Define deterministic union handling that prefers an exact primitive-type
      match before numeric coercion.
- [ ] Add proof coverage for integer JSON into RTTI `number`, decimal/exponent
      JSON into RTTI `bigint`, safe/unsafe conversions, numeric consts, `0`/`-0`,
      unions, and nested containers.
- [ ] `npx tsc`, `fjs test`.

### Related

- [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md) — shared
  schema-neutral JSON text parser and value representation.
- [Standard JSON transformer](./standard-transform.md) — alternative policy layer
  that removes bigint without RTTI.
- [`fjs/types/rtti/parse`](../../../types/rtti/parse/module.f.ts) — existing strict
  runtime-value parser whose structural behavior should be reused where possible,
  not changed to add JSON-specific coercion.
- [RTTI serializable data representation](../../../types/rtti/todo/serializable-data.md)
  — a future data-driven RTTI parser can support the same JSON numeric conversion
  policy.
