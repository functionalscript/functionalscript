## Transform between extended and standard JSON values

**Priority:** P3
**Status:** blocked
**Blocked by:** [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md)

### Problem

The extended JSON representation preserves bare JSON integers as `bigint`, while
the existing standard JSON value type has only JavaScript `number`. We need an
explicit conversion layer between those two value domains instead of duplicating
the structural JSON parser/serializer.

The conversion is intentionally asymmetric:

- extended JSON -> standard JSON removes `bigint`, accepting the normal
  JavaScript-number precision loss where necessary;
- standard JSON -> extended JSON should canonicalize whole-valued numbers back to
  `bigint` so normal JSON values such as `[1, 2, 3]` serialize as `[1,2,3]`, not
  `[1.0,2.0,3.0]`.

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
Object.is(value, -0)   -> keep -0 as number
Number.isInteger(value) -> BigInt(value)
otherwise               -> keep value as number
```

Other leaves are unchanged and arrays/objects are rebuilt recursively.

This canonicalizes ordinary integer-valued JavaScript numbers before the
extended serializer sees them:

```text
[1, 2, 3]
    -> [1n, 2n, 3n]
    -> "[1,2,3]"
```

Negative zero is deliberately excluded from integer canonicalization because
`bigint` has no negative zero:

```text
-0 -> -0 -> "-0"
```

The transformation uses the numeric value already present in JavaScript. For an
unsafe integer-valued `number`, `BigInt(value)` captures that represented value;
it cannot recover precision that was already lost before the transformer ran.

### Composition

Use these transformers to build the ordinary JSON surface on top of the extended
JSON implementation rather than maintaining another structural parser:

```text
standard parse:
JSON text -> extended parse -> extendedToStandard -> standard JSON value

standard stringify:
standard JSON value -> standardToExtended -> extended stringify -> JSON text
```

The resulting text is ordinary valid JSON. The extended representation remains
the shared structural parse/serialize layer; standard JSON is a policy applied
on top of it.

### Tasks

- [ ] Add `extendedToStandard` (name TBD) that recursively converts every
      extended `bigint` leaf with `Number` and otherwise preserves values.
- [ ] Add `standardToExtended` (name TBD) that recursively converts integer-valued
      numbers to `bigint`, except `-0`.
- [ ] Rebuild arrays and objects immutably in both directions.
- [ ] Compose the standard JSON parser from extended parse + extended-to-standard
      transform.
- [ ] Compose the standard JSON serializer/stringifier from standard-to-extended
      transform + extended serialization.
- [ ] Ensure whole-valued standard numbers serialize with ordinary integer JSON
      syntax (`[1,2,3]`, not `[1.0,2.0,3.0]`).
- [ ] Add proof coverage for safe/unsafe integers, fractions, exponents, `0`,
      `-0`, nested arrays/objects, and large bigint precision loss at the
      extended-to-standard boundary.
- [ ] `npx tsc`, `fjs test`.

### Related

- [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md) — provides
  the intermediate value type and JSON text codec.
- [RTTI-aware extended JSON parser](./rtti-parse.md) — another policy layer over
  the same extended JSON representation.
- [Generic JSON/DJS tree type](../../../djs/todo/663-json-djs-tree-type.md) — if
  it lands first, reuse its generic recursive tree shape rather than duplicating
  traversal types.
