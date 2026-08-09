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
- integer-valued `number`s outside the built-in safe-integer range;
- the positive and negative boundaries where native `JSON.stringify` changes
  from plain integer notation to exponent notation;
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

Standard stringify has a separate integer-spelling problem. The initial
conservative direction was to convert only `Number.isSafeInteger(value)` values
to `bigint` before extended serialization. That preserves ordinary integers but
is not enough to match native `JSON.stringify`: some unsafe integer-valued
numbers, such as values around `9e15` through the plain-decimal range, still
serialize without exponent notation. Keeping those as extended `number` would
force an information-preserving non-integer spelling such as `.0`, changing the
standard API output.

Investigate the actual native spelling boundary instead of equating
"serialization-safe" with `Number.MAX_SAFE_INTEGER`. Provisionally call the
largest positive integer-valued `number` that still uses plain integer JSON
syntax `max_safe_integer`, and the most-negative corresponding value
`min_safe_integer` (names TBD). These are local serialization concepts, not
aliases for `Number.MAX_SAFE_INTEGER` / `Number.MIN_SAFE_INTEGER`, and the
positive/negative boundaries must not be assumed symmetric.

The boundary alone may still be insufficient. For unsafe integer-valued numbers,
`BigInt(value)` represents the exact integer value of the binary floating-point
number, while `JSON.stringify(value)` uses the shortest decimal spelling that
round-trips to the same `number`. The investigation must verify whether converting
all integers inside the candidate bounds preserves the exact native decimal text.
If it does not, standard stringify needs either a stricter conversion predicate or
a compatibility-specific number serialization path.

### Questions to investigate

Do not choose a concrete overflow representation or integer conversion predicate
in this TODO yet except where a direction is already settled above. First
document the relevant native JavaScript behavior and the information-preserving
options for the extended layer.

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
- [ ] Determine the positive `max_safe_integer` candidate: the greatest
      integer-valued JavaScript `number` for which native `JSON.stringify`
      produces plain integer syntax without `e` / `E`.
- [ ] Determine the negative `min_safe_integer` candidate independently: the
      least integer-valued JavaScript `number` for which native `JSON.stringify`
      still produces plain integer syntax. Do not assume it is exactly
      `-max_safe_integer`.
- [ ] Clearly distinguish these serialization bounds from the built-in
      `Number.MAX_SAFE_INTEGER` / `Number.MIN_SAFE_INTEGER` exact-arithmetic
      bounds; choose final names that avoid accidental confusion if needed.
- [ ] Test representative and boundary-adjacent unsafe integers throughout the
      candidate interval and compare `JSON.stringify(value)` with
      `BigInt(value).toString()`.
- [ ] Determine whether the candidate min/max interval alone guarantees exact
      native spelling after conversion to `bigint`. If not, define a stricter
      predicate, such as requiring the bigint decimal spelling to equal the
      native JSON number spelling, or retain a standard-only number serializer
      for the mismatching cases.
- [ ] Compare native `JSON.stringify` output for large integer-valued numbers such
      as `9007199254740992`, `1e20`, `1e21`, `1e100`, and `1e200`, plus their
      negative counterparts, with the output produced after candidate conversion.
- [ ] Keep exponent-form integer-valued values as `number` when exponent notation
      is the native compact representation; do not expand them to huge bigint
      decimal literals merely because `Number.isInteger(value)` is true.
- [ ] Verify that extended `bigint` serialization always uses full canonical
      base-10 integer digits and never exponent notation; exponent notation must
      remain lexically associated with `number`.
- [ ] Settle the reusable standard-to-extended integer conversion predicate and
      the standard `json.stringify` compatibility path together so native spelling
      is preserved for every integer-valued `number`.
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
- [ ] Determine where any standard-stringify-only normalization or primitive
      number serialization belongs so the reusable standard/extended value
      transformers do not lose information unnecessarily.
- [ ] Add proof cases for every settled behavior before implementation of the new
      JSON surfaces is considered complete.

### Related

- [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md) — owns the
  information-preserving intermediate JSON representation and is blocked on this
  task for exponent-overflow/non-finite behavior.
- [Standard JSON transformer](./standard-transform.md) — now also blocked on this
  investigation for the exact integer-to-bigint/stringify compatibility boundary.
- [`fjs/media/json/module.f.ts`](../module.f.ts) — current standard JSON surface.
- [`fjs/media/json/serializer/module.f.ts`](../serializer/module.f.ts) — current
  number serialization behavior to compare with native `JSON.stringify`.
