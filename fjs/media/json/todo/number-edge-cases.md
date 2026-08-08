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

Most numeric cases are straightforward, but JavaScript has values or conversions
whose behavior needs to be verified deliberately rather than inherited
accidentally from an implementation detail:

- negative zero (`-0`);
- positive infinity (`Infinity`);
- negative infinity (`-Infinity`);
- `NaN`;
- exponent syntax whose numeric conversion overflows to a non-finite value;
- integer-valued `number`s outside the safe-integer range.

JSON text itself cannot spell `Infinity`, `-Infinity`, or `NaN`, while JavaScript
callers can still pass them to a serializer. However, valid JSON number syntax can
produce a non-finite JavaScript result when converted directly to `number`; for
example, very large exponent forms such as `1e400` require an explicit policy.
Negative zero is valid JSON number syntax, but parse/stringify behavior is
asymmetric in the standard JavaScript API.

### Settled direction

Standard-to-extended conversion should only canonicalize safe integer-valued
JavaScript numbers to `bigint`:

```text
Object.is(value, -0)        -> keep -0 as number
Number.isSafeInteger(value) -> BigInt(value)
otherwise                   -> keep value as number
```

Unsafe integer-valued numbers such as `1e200` remain `number`. This avoids
expanding compact exponent notation into hundreds of decimal digits and is closer
to the native `JSON.stringify` compatibility goal.

### Questions to investigate

Do not choose the remaining behavior in this TODO yet. First document the
relevant native JavaScript behavior and the information-preserving options for
the extended layer.

- [ ] Verify `JSON.parse` behavior for `0`, `-0`, decimal zero, and exponent zero,
      including `Object.is` checks for the resulting values.
- [ ] Verify `JSON.parse` and direct numeric conversion behavior for large valid
      exponent forms such as `1e308`, `1e309`, `1e400`, and negative equivalents.
- [ ] Decide whether extended parse should accept an overflowed exponent as a
      non-finite `number`, reject it, or preserve it in another representation;
      account for the requirement that extended serialization still produce
      valid JSON and has a defined round-trip/error contract.
- [ ] Verify `JSON.stringify` behavior for `0`, `-0`, `NaN`, `Infinity`, and
      `-Infinity` at the top level, in arrays, and in object properties.
- [ ] Confirm how the existing `fjs/media/json` parser/serializer behaves for the
      same cases and record any difference from native `JSON.*`.
- [ ] Compare native `JSON.stringify` output for large integer-valued numbers such
      as `1e20`, `1e21`, `1e100`, and `1e200` and confirm that keeping unsafe
      integer-valued numbers as `number` preserves the intended compatibility.
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

- [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md) — blocked by
  this investigation because valid exponent syntax can overflow the JavaScript
  `number` domain and needs a defined parse/serialize contract.
- [Standard JSON transformer](./standard-transform.md) — builds the compatibility
  surface on top of extended JSON and uses `Number.isSafeInteger` for integer
  canonicalization.
- [`fjs/media/json/module.f.ts`](../module.f.ts) — current standard JSON surface.
- [`fjs/media/json/serializer/module.f.ts`](../serializer/module.f.ts) — current
  number serialization behavior to compare with native `JSON.stringify`.
