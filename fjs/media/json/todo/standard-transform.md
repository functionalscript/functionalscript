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
  to `bigint`, but the exact conversion predicate used by standard stringify must
  preserve native `JSON.stringify` spelling.

`Number.isSafeInteger` is not the serialization boundary. Native stringify keeps
plain decimal integer notation through:

```text
min_plain_integer = -999999999999999900000
max_plain_integer =  999999999999999900000
```

and switches to exponent notation at `-1e21` / `1e21`. These are spelling bounds,
not exact-arithmetic bounds, and must not be confused with
`Number.MIN_SAFE_INTEGER` / `Number.MAX_SAFE_INTEGER`.

The bounds are also not sufficient as the conversion predicate. At the positive
boundary, for example, native stringify chooses the shortest round-tripping
spelling `"999999999999999900000"`, while
`BigInt(999999999999999900000).toString()` yields the exact binary-double integer
`"999999999999999868928"`. Converting every integer-valued number inside the
plain-spelling interval to `bigint` would therefore change standard JSON output.
The remaining [number edge cases](./number-edge-cases.md) work must settle a
stricter compatibility predicate or a standard-only number serialization path.

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
`Number.isSafeInteger` or a simple
`min_plain_integer <= value <= max_plain_integer` check.

A conversion to `bigint` is valid for the standard stringify path only when it
preserves the exact native number spelling. The numeric-edge investigation must
define a practical predicate for that property, or standard stringify must retain
a compatibility-specific number serialization path for values whose shortest
native decimal spelling differs from the exact bigint integer.

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
investigation settles which plain-spelled integer values can be converted to
`bigint` without changing native spelling. Values that fail that predicate must
retain a compatibility-specific number path instead of being forced through the
extended number round-trip rule.

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
exponent overflow, exact plain-integer conversion compatibility, and other edge
rules) is tracked separately in [number edge cases](./number-edge-cases.md) so it
is verified explicitly instead of being chosen accidentally during implementation.

### Tasks

- [ ] Add `extendedToStandard` (name TBD) that recursively converts every
      extended `bigint` leaf with `Number` and otherwise preserves values.
- [ ] After the numeric-edge investigation, add `standardToExtended` (name TBD)
      with the settled integer-to-`bigint` predicate; do not assume
      `Number.isSafeInteger` or the plain-spelling interval is sufficient.
- [ ] Preserve `-0` as `number` in the reusable value transformer.
- [ ] Rebuild arrays and objects immutably in both directions.
- [ ] Compose the standard JSON parser from extended parse + extended-to-standard
      transform.
- [ ] Use the settled native spelling boundaries
      `[-999999999999999900000, 999999999999999900000]` only as information about
      where exponent notation begins, not as the bigint-conversion predicate.
- [ ] Settle standard stringify composition from the numeric-edge result: convert
      only values whose exact bigint decimal spelling is compatible with native
      output, or retain a standard-number serialization path for the others.
- [ ] Preserve native/current standard behavior for `-0`: stringify it as `0`,
      while keeping the reusable runtime transformer information-preserving.
- [ ] Ensure ordinary whole-valued standard numbers serialize with the exact
      spelling native `JSON.stringify` would produce, including unsafe integers
      whose native spelling contains no exponent.
- [ ] Keep exponent-form integer-valued numbers as `number` when that is the
      native compact representation.
- [ ] Add proof coverage comparing the standard surface with native `JSON.*` for
      numeric compatibility cases, including values around the settled positive
      and negative integer spelling boundaries, the boundary spelling mismatch,
      fractions, nested arrays/objects, and large bigint precision loss at the
      extended-to-standard boundary.
- [ ] `npx tsc`, `fjs test`.

### Related

- [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md) — provides
  the intermediate value type and JSON text codec.
- [JSON numeric edge cases](./number-edge-cases.md) — blocks this task until the
  final standard integer conversion/stringify policy and exceptional-number
  behavior are settled.
- [RTTI-aware extended JSON parser](./rtti-parse.md) — another policy layer over
  the same extended JSON representation.
- [Generic JSON/DJS tree type](../../../djs/todo/663-json-djs-tree-type.md) — if
  it lands first, reuse its generic recursive tree shape rather than duplicating
  traversal types.
