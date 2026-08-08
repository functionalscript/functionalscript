## Transform between extended and standard JSON values

**Priority:** P3
**Status:** blocked
**Blocked by:** [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md)

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
- standard JSON -> extended JSON canonicalizes safe integer-valued numbers back
  to `bigint` so values such as `[1, 2, 3]` serialize as `[1,2,3]`, not
  `[1.0,2.0,3.0]`, while larger integer-valued numbers remain `number`.

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

Transform every standard JSON `number` leaf as follows:

```text
Object.is(value, -0)        -> keep -0 as number
Number.isSafeInteger(value) -> BigInt(value)
otherwise                   -> keep value as number
```

Other leaves are unchanged and arrays/objects are rebuilt recursively.

This transformer itself preserves `-0`; it is a conversion between runtime value
domains, not a reimplementation of `JSON.stringify`:

```text
[1, 2, 3] -> [1n, 2n, 3n]
-0        -> -0
1e200     -> 1e200 as number
```

Only safe integers are canonicalized to `bigint`. An unsafe integer-valued
`number` is already an approximate IEEE-754 value and remains a `number`. This
also avoids changing compact standard serialization such as `1e+200` into a
hundreds-of-digits decimal bigint literal.

### Standard compatibility surface

Build standard parse/stringify on top of the extended layer, but do not let the
extended serializer's information-preserving choices accidentally change the
public standard API.

```text
standard parse:
JSON text -> extended parse -> extendedToStandard -> standard JSON value

standard stringify:
standard JSON value -> standardToExtended -> standard compatibility normalization
                    -> extended stringify -> JSON text
```

The compatibility normalization exists only where native `JSON.stringify`
requires behavior different from the reusable value transformer. In particular,
standard stringify must preserve current/native behavior for negative zero:

```text
JSON.stringify(-0) == "0"
standard json.stringify(-0) == "0"
```

Therefore standard stringify must normalize `-0` before the extended serializer
sees it, even though `standardToExtended(-0)` itself keeps `-0` so the generic
runtime transformer does not discard information.

The standard surface should be treated as compatibility API. Users that want
more information-preserving behavior should use the extended representation and
its transformers directly.

The remaining exceptional-number behavior (`NaN`, `Infinity`, `-Infinity`, and
numeric syntax that overflows a JavaScript `number`) is tracked separately in
[number edge cases](./number-edge-cases.md) so it is verified explicitly instead
of being chosen accidentally during implementation.

### Tasks

- [ ] Add `extendedToStandard` (name TBD) that recursively converts every
      extended `bigint` leaf with `Number` and otherwise preserves values.
- [ ] Add `standardToExtended` (name TBD) that recursively converts only
      `Number.isSafeInteger` values to `bigint`, except `-0`.
- [ ] Keep unsafe integer-valued numbers as `number`; in particular, do not expand
      values such as `1e200` into large decimal bigint literals.
- [ ] Rebuild arrays and objects immutably in both directions.
- [ ] Compose the standard JSON parser from extended parse + extended-to-standard
      transform.
- [ ] Compose standard stringify from standard-to-extended + the minimal native
      `JSON.stringify` compatibility normalization + extended serialization.
- [ ] Preserve native/current standard behavior for `-0`: stringify it as `0`,
      while keeping `standardToExtended(-0)` information-preserving.
- [ ] Ensure safe whole-valued standard numbers serialize with ordinary integer
      JSON syntax (`[1,2,3]`, not `[1.0,2.0,3.0]`).
- [ ] Add proof coverage comparing the standard surface with native `JSON.*` for
      numeric compatibility cases, including safe/unsafe integers, `1e200`,
      fractions, nested arrays/objects, and large bigint precision loss at the
      extended-to-standard boundary.
- [ ] `npx tsc`, `fjs test`.

### Related

- [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md) — provides
  the intermediate value type and JSON text codec.
- [JSON numeric edge cases](./number-edge-cases.md) — investigates exceptional
  JavaScript numbers and exponent overflow before their final policies are fixed.
- [RTTI-aware extended JSON parser](./rtti-parse.md) — another policy layer over
  the same extended JSON representation.
- [Generic JSON/DJS tree type](../../../djs/todo/663-json-djs-tree-type.md) — if
  it lands first, reuse its generic recursive tree shape rather than duplicating
  traversal types.
