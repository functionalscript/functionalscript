## Transform between extended and standard JSON values

**Priority:** P3
**Status:** blocked
**Blocked by:** [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md), [JSON numeric edge cases](./number-edge-cases.md)

### Problem

The extended JSON representation preserves bare JSON integers as `bigint`, while
the existing standard JSON value type has only JavaScript `number`. We need an
explicit conversion layer between those two value domains instead of duplicating
the structural JSON parser/serializer.

The two layers have different goals:

- extended JSON is the information-preserving intermediate representation;
- the standard `json.*` surface is a compatibility layer and should match native
  JavaScript `JSON.parse` / `JSON.stringify` semantics, including their lossy
  edge cases.

The value conversion is intentionally asymmetric:

- extended JSON -> standard JSON removes `bigint`, accepting the normal
  JavaScript-number precision loss where necessary;
- standard JSON -> extended JSON may canonicalize some whole-valued numbers back
  to `bigint`, but the exact conversion boundary used by standard stringify must
  preserve native `JSON.stringify` spelling.

`Number.isSafeInteger` is a conservative value-domain boundary, but it is not the
final serialization boundary. Some unsafe integer-valued numbers are still
serialized by native `JSON.stringify` with plain integer syntax rather than
exponent notation. The exact positive and negative boundaries, and whether a
simple interval is sufficient at all, are part of the blocked
[number edge cases](./number-edge-cases.md) investigation.

### Proposal

Add recursive transformers between the standard `fjs/media/json` value type and
the extended JSON value type.

#### Extended -> standard

Transform every extended JSON leaf as follows:

```text
bigint       -> Number(value)
number       -> unchanged
string       -> unchanged
boolean      -> unchanged
null         -> unchanged
```

Arrays and objects are rebuilt recursively.

Converting `bigint` to `number` may round large integers or overflow to
`Infinity`. That is expected at this boundary: the target type is the ordinary
JavaScript JSON value domain, which cannot represent arbitrary-precision
integers.

#### Standard -> extended

The exact integer-to-`bigint` predicate is blocked on the numeric-edge
investigation. Its required shape is:

```text
Object.is(value, -0)                  -> keep -0 as number
isStandardIntegerForBigInt(value)     -> BigInt(value)
otherwise                             -> keep value as number
```

`isStandardIntegerForBigInt` is a name placeholder, not a decided API. It must be
defined from native `JSON.stringify` compatibility rather than assumed to be
`Number.isSafeInteger`.

The investigation will determine candidate positive and negative serialization
bounds (provisionally `max_safe_integer` and `min_safe_integer`; names TBD) by
finding where native `JSON.stringify` stops using plain integer syntax and
switches to exponent notation. The bounds are not assumed to be symmetric and
must not be confused with `Number.MAX_SAFE_INTEGER` /
`Number.MIN_SAFE_INTEGER`.

A simple bound check is acceptable only if it also preserves the exact native
spelling. For an unsafe integer-valued `number`, `BigInt(value).toString()` can in
principle differ from the shortest decimal spelling chosen by
`JSON.stringify(value)`. The investigation must verify this across the candidate
range. If bounds alone are insufficient, use a stricter predicate (for example,
requiring the bigint decimal spelling to equal native stringify output) or give
standard stringify a compatibility-specific number serialization path.

This transformer itself preserves `-0`; it is a conversion between runtime value
domains, not a reimplementation of `JSON.stringify`.

### Standard compatibility surface

Build standard parse/stringify on top of the extended layer, but do not let the
extended serializer's information-preserving choices accidentally change the
public standard API.

```text
standard parse:
JSON text -> extended parse -> extendedToStandard -> standard JSON value

standard stringify:
standard JSON value -> settled compatibility conversion/normalization
                    -> extended structural serialization or standard-number path
                    -> JSON text
```

The exact stringify composition is intentionally blocked until the numeric-edge
investigation settles whether all native plain-integer spellings can be preserved
by converting those values to `bigint`. If not, standard stringify must retain a
compatibility-specific number serialization path instead of forcing every value
through the extended number round-trip rule.

The compatibility normalization exists only where native `JSON.stringify`
requires behavior different from the reusable value transformer. In particular,
standard stringify must preserve current/native behavior for negative zero:

```text
JSON.stringify(-0) == "0"
standard json.stringify(-0) == "0"
```

Therefore standard stringify must normalize `-0` before the extended serializer
sees it, even though the reusable standard-to-extended transformer keeps `-0` so
the generic runtime conversion does not discard information.

The standard surface should be treated as compatibility API. Users that want
more information-preserving behavior should use the extended representation and
its transformers directly.

The remaining exceptional-number behavior (`NaN`, `Infinity`, `-Infinity`,
exponent overflow, integer spelling boundaries, and other exact edge rules) is
tracked separately in [number edge cases](./number-edge-cases.md) so it is
verified explicitly instead of being chosen accidentally during implementation.

### Tasks

- [ ] Add `extendedToStandard` (name TBD) that recursively converts every
      extended `bigint` leaf with `Number` and otherwise preserves values.
- [ ] After the numeric-edge investigation, add `standardToExtended` (name TBD)
      with the settled integer-to-`bigint` predicate; do not assume
      `Number.isSafeInteger` is the final serialization boundary.
- [ ] Preserve `-0` as `number` in the reusable value transformer.
- [ ] Rebuild arrays and objects immutably in both directions.
- [ ] Compose the standard JSON parser from extended parse + extended-to-standard
      transform.
- [ ] Settle standard stringify composition from the numeric-edge result: either
      convert every compatible plain-spelled integer to `bigint`, or retain a
      standard-number serialization path for cases that cannot round-trip through
      extended number syntax without changing native spelling.
- [ ] Preserve native/current standard behavior for `-0`: stringify it as `0`,
      while keeping the reusable runtime transformer information-preserving.
- [ ] Ensure ordinary whole-valued standard numbers serialize with the exact
      spelling native `JSON.stringify` would produce, including unsafe integers
      whose native spelling contains no exponent.
- [ ] Keep exponent-form integer-valued numbers as `number` when that is the
      native compact representation.
- [ ] Add proof coverage comparing the standard surface with native `JSON.*` for
      numeric compatibility cases, including values around the settled positive
      and negative integer spelling boundaries, fractions, nested arrays/objects,
      and large bigint precision loss at the extended-to-standard boundary.
- [ ] `npx tsc`, `fjs test`.

### Related

- [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md) — provides
  the intermediate value type and JSON text codec.
- [JSON numeric edge cases](./number-edge-cases.md) — blocks this task until the
  standard integer spelling/conversion boundary and exceptional-number behavior
  are settled.
- [RTTI-aware extended JSON parser](./rtti-parse.md) — another policy layer over
  the same extended JSON representation.
- [Generic JSON/DJS tree type](../../../djs/todo/663-json-djs-tree-type.md) — if
  it lands first, reuse its generic recursive tree shape rather than duplicating
  traversal types.
