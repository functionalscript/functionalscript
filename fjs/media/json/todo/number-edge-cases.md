## Investigate JSON numeric edge cases

**Priority:** P3
**Status:** open

### Problem

The extended JSON layer and the standard `fjs/media/json` compatibility layer
have different goals:

- extended JSON should preserve information from valid JSON text and expose an
  explicit numeric runtime representation;
- standard `json.*` should match JavaScript `JSON.parse` / `JSON.stringify`
  behavior, even where that behavior is lossy.

Most numeric cases are straightforward, but JavaScript has values whose behavior
needs to be verified deliberately rather than inherited accidentally from an
implementation detail:

- negative zero (`-0`);
- positive infinity (`Infinity`);
- negative infinity (`-Infinity`);
- `NaN`;
- integer-valued `number`s outside the safe-integer range;
- exponent syntax whose numeric conversion overflows the finite JavaScript
  `number` range, such as `1e400`.

JSON text itself cannot spell the non-finite values, while JavaScript callers can
still pass them to a serializer. Negative zero is valid JSON number syntax, but
parse/stringify behavior is asymmetric in the standard JavaScript API.

For the extended parser, exponent notation has a fixed lexical meaning: any JSON
number token containing `e` or `E` is a `number`, not a `bigint`, even when its
mathematical value is integral. The open question is how the extended layer
represents a valid exponent token that cannot be represented as a finite
JavaScript `number`.

The shared-parser architecture adds one hard compatibility constraint: standard
`json.parse` is intended to compose `extended parse -> extendedToStandard`, and
native `JSON.parse('1e400')` succeeds with `Infinity`. Therefore the extended
parsing path must not simply reject valid overflowed exponent syntax if it is to
remain the common substrate for the standard parser. It must preserve enough
information for the standard boundary to produce the same result as native
`JSON.parse`. If investigation shows that cannot be done cleanly in the extended
value model, the alternative is to define an explicit separate compatibility
path rather than silently changing standard parse behavior.

The standard-to-extended transformer also needs care when deciding which
integer-valued JavaScript `number`s should become `bigint`. Mapping every value
for which `Number.isInteger(value)` is true can significantly change standard
stringify output. For example, a value such as `1e200` is integer-valued as a
JavaScript `number`; converting it to `bigint` would serialize the represented
binary floating-point integer as a decimal integer with hundreds of digits
instead of preserving a compact exponent form such as `1e+200`.

The current direction is to convert only `Number.isSafeInteger(value)` values to
`bigint` in the standard-to-extended path. This keeps ordinary exact integers
canonical while leaving unsafe integer-valued numbers as `number` so compact
number notation remains available.

### Questions to investigate

Do not choose a concrete overflow representation in this TODO yet except where a
direction is already settled above. First document the relevant native JavaScript
behavior and the information-preserving options for the extended layer.

- [ ] Verify `JSON.parse` behavior for `0`, `-0`, decimal zero, exponent zero, and
      overflowed exponent syntax such as `1e400`, including `Object.is` checks for
      the resulting values where relevant.
- [ ] Verify `JSON.stringify` behavior for `0`, `-0`, `NaN`, `Infinity`, and
      `-Infinity` at the top level, in arrays, and in object properties.
- [ ] Confirm how the existing `fjs/media/json` parser/serializer behaves for the
      same cases and record any difference from native `JSON.*`.
- [ ] Verify and document the settled lexical rule that any number token containing
      `e` / `E` parses as `number`, never `bigint`, regardless of whether the
      resulting numeric value is mathematically integral.
- [ ] Choose an extended representation/policy for valid exponent syntax that
      overflows finite JavaScript `number`, such as `1e400`, while preserving the
      shared-parser requirement that standard conversion can produce the same
      result as native `JSON.parse` (`Infinity` / `-Infinity` as applicable).
- [ ] If no clean extended representation satisfies that requirement, explicitly
      design a separate standard compatibility parse path instead of rejecting
      syntax that native `JSON.parse` accepts.
- [ ] Define the matching extended-serialization/error behavior for any value or
      representation chosen for overflowed exponent input so parse/serialize has
      a coherent contract.
- [ ] Verify that standard-to-extended conversion used by `json.stringify` maps
      only `Number.isSafeInteger(value)` values to `bigint`, not every
      `Number.isInteger(value)` value.
- [ ] Compare native `JSON.stringify` output for large integer-valued numbers such
      as `1e20`, `1e21`, `1e100`, and `1e200` with the output produced after
      conversion; avoid accidentally expanding compact exponent notation into
      very large decimal integer literals.
- [ ] Verify that extended `bigint` serialization always uses full canonical
      base-10 integer digits and never exponent notation; exponent notation must
      remain lexically associated with `number`.
- [ ] Decide whether the reusable standard-to-extended transformer and the
      standard `json.stringify` compatibility path should use exactly the same
      integer-conversion policy or whether stringify needs a compatibility-specific
      normalization policy beyond the settled safe-integer rule.
- [ ] Decide which representations the extended serializer should accept for
      programmatically-created `number` leaves that are `NaN` or infinite.
- [ ] Decide whether an unsupported extended numeric value should fail,
      normalize, or use another policy while still producing only valid JSON
      text.
- [ ] Verify that extended handling of negative zero preserves the distinction
      needed by the one-to-one numeric representation and document the exact
      lexical rule.
- [ ] Define the standard compatibility policy separately from the extended
      policy. The standard `json.*` surface should be judged against native
      `JSON.parse` / `JSON.stringify`, not against the extended layer's
      information-preserving behavior.
- [ ] Determine where any standard-stringify-only normalization belongs so the
      reusable standard/extended value transformers do not lose information
      unnecessarily.
- [ ] Add proof cases for every settled behavior before implementation of the new
      JSON surfaces is considered complete.

### Related

- [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md) — owns the
  information-preserving intermediate JSON representation and is blocked on this
  task for exponent-overflow/non-finite behavior.
- [Standard JSON transformer](./standard-transform.md) — builds the compatibility
  surface on top of extended JSON.
- [`fjs/media/json/module.f.ts`](../module.f.ts) — current standard JSON surface.
- [`fjs/media/json/serializer/module.f.ts`](../serializer/module.f.ts) — current
  number serialization behavior to compare with native `JSON.stringify`.
