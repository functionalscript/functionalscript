## Transform between extended and standard JSON values

**Priority:** P3
**Status:** open

### Problem

The extended JSON runtime representation adds `bigint`, while the ordinary
`fjs/media/json` value domain has only JavaScript `number`. We need explicit
recursive conversions between those two runtime value domains.

This task is only about **value transformation**. It does not define the public
`json.parse` / `json.stringify` codec and it does not require the result to mimic
native JavaScript `JSON.parse` / `JSON.stringify` edge behavior or textual
spelling.

Those are separate concerns:

- [Standard JSON parse/serialize](./standard-parse-serialize.md) owns the ordinary
  FunctionalScript JSON codec over the shared lossless structural parser and
  serializer.
- [Native JSON compatibility](./native-json-compatibility.md) is P5 follow-up work
  and must not constrain these reusable transforms.

Keeping this boundary narrow avoids making a generic runtime conversion depend on
questions such as native shortest-double spelling, `JSON.stringify(-0)`, or the
host's treatment of non-finite numbers.

### Proposal

Add two recursive value transformers.

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

`Number(value)` may round a large bigint or overflow to `Infinity`. That is an
explicit consequence of converting from the arbitrary-precision extended domain
to the ordinary JavaScript-number domain; the transformer does not pretend this
conversion is lossless.

#### Standard -> extended

Use a simple exact-number canonicalization rule rather than a native-stringify
compatibility rule:

```text
Object.is(value, -0)      -> keep -0 as number
Number.isSafeInteger(v)   -> BigInt(v)
otherwise                 -> keep value as number
```

`Number.isSafeInteger` is appropriate here because it identifies the ordinary
integer values that can be promoted to bigint without first relying on an
inexact integer interpretation. It is **not** claimed to be a serialization
boundary and is intentionally unrelated to the decimal spelling chosen by
native `JSON.stringify`.

The `-0` case must run first because `Number.isSafeInteger(-0)` is true while
`bigint` has no negative zero.

This transformer is allowed to be conservative. An unsafe integer-valued
`number` can remain a `number`; converting every mathematically integral double
to bigint is not a goal of this utility.

### Properties

The reusable transformations should have simple, testable semantics:

- `extendedToStandard` removes every bigint leaf recursively.
- `standardToExtended` never changes a non-number primitive.
- `standardToExtended` preserves `-0` as a number.
- safe integer numbers become exact bigint values.
- unsafe/fractional/non-finite numbers remain numbers.
- arrays and objects are rebuilt immutably.

Do not add native JSON formatting rules to make a transformed value serialize the
same way as `JSON.stringify`. Compatibility can be improved later after these
transforms exist, through documented breaking changes to `json.*` or through a
separate compatible API if both contracts prove useful. That decision belongs to
the P5 [native JSON compatibility](./native-json-compatibility.md) task.

### Tasks

- [ ] Add `extendedToStandard` (name TBD) that recursively converts every bigint
      leaf with `Number` and otherwise preserves the runtime value.
- [ ] Add `standardToExtended` (name TBD) using the ordered `-0` /
      `Number.isSafeInteger` rules above.
- [ ] Rebuild arrays and objects immutably in both directions.
- [ ] Prove safe integer promotion, fractional values, unsafe integer-valued
      numbers, bigint precision loss on the reverse transform, positive zero,
      and negative zero.
- [ ] Keep parser/stringifier composition and native `JSON.*` compatibility out
      of these reusable transforms.
- [ ] `tsc`, `fjs test`.

### Related

- [`fjs/media/json/extended/types.ts`](../extended/types.ts) — the extended
  runtime value domain these transforms convert to and from.
- [Standard JSON parse/serialize](./standard-parse-serialize.md) — owns the
  ordinary `json.parse` / `json.stringify` codec.
- [Native JSON compatibility](./native-json-compatibility.md) — P5 follow-up;
  does not block this task.
- [JSON numeric edge cases](./number-edge-cases.md) — owns extended/default codec
  decisions for values that are not straightforward finite numbers.
- [RTTI-aware extended JSON parser](./rtti-parse.md) — another consumer of the
  shared lossless structural parse.
- [Generic JSON/DJS tree type](../../../djs/todo/663-json-djs-tree-type.md) — if
  it lands first, reuse its generic recursive tree shape rather than duplicating
  traversal types.
