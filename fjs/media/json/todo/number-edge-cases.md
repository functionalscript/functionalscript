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
  `number` range, such as `1e400`;
- bare integer syntax whose coefficient is too large for the runtime's `bigint`
  implementation to construct directly.

JSON text itself cannot spell the non-finite values, while JavaScript callers can
still pass them to a serializer. Negative zero is valid JSON number syntax, but
parse/stringify behavior is asymmetric in the standard JavaScript API.

For the extended parser, exponent notation has a fixed lexical meaning: any JSON
number token containing `e` or `E` is a `number`, not a `bigint`, even when its
mathematical value is integral. The open question is how the extended layer
represents a valid exponent token that cannot be represented as a finite
JavaScript `number`.

Bare integer syntax has a separate runtime-limit edge. The extended lexical rule
normally materializes a bare integer as `bigint`, but the runtime may reject a
coefficient beyond its supported bigint size. The shared structural parser must
therefore retain `NumberToken.value` before bigint construction and must not let a
valid JSON token escape as an uncaught `BigInt(...)` exception. The numeric policy
must decide whether such a token has an extended representation or produces a
controlled extended-parse failure.

The shared-parser architecture adds a compatibility constraint for both kinds of
overflow. Native `JSON.parse` accepts valid numeric text that may materialize as a
finite rounded `number` or as `Infinity`, including sufficiently large bare
integers. Standard `json.parse` therefore must still be able to consume the
lossless `NumberToken` tree even when the extended runtime value cannot be
materialized as a finite `number` or supported `bigint`. Prefer preserving the
single tokenizer/structural parser and choosing materialization afterward. If the
standard parser cannot cleanly compose through `ExtendedUnknown` for an overflow
case, define an explicit standard compatibility materialization from the same
lossless tree rather than duplicating the structural parser or rejecting syntax
that native `JSON.parse` accepts.

### Native plain-integer spelling boundary

The native `JSON.stringify` boundary has now been measured. The largest positive
integer-valued double still written in plain decimal form is:

```text
max_plain_integer = 999999999999999900000
```

The next representable double is `1e21`, which is still integer-valued but is
serialized with exponent notation:

```text
JSON.stringify(max_plain_integer) == "999999999999999900000"
JSON.stringify(1e21)              == "1e+21"
```

The negative boundary is symmetric:

```text
min_plain_integer = -999999999999999900000
JSON.stringify(min_plain_integer) == "-999999999999999900000"
JSON.stringify(-1e21)             == "-1e+21"
```

A sweep across the double range and around the transition found no sign
asymmetry, consistent with number formatting operating on the magnitude and then
prefixing the negative sign. Use the names `max_plain_integer` and
`min_plain_integer` (or equivalent final API names) rather than
`max_safe_integer` / `min_safe_integer`: these are serialization-spelling bounds,
not exact-arithmetic bounds, and are far outside `Number.MAX_SAFE_INTEGER` /
`Number.MIN_SAFE_INTEGER`.

The plain-spelling bounds are **not** sufficient as the standard-to-extended
integer conversion predicate. Unsafe integer-valued doubles can have a shortest
decimal spelling different from the exact integer represented by the binary
floating-point value. At the upper boundary itself:

```text
JSON.stringify(999999999999999900000)
    == "999999999999999900000"

BigInt(999999999999999900000).toString()
    == "999999999999999868928"
```

Therefore converting every integer-valued number inside
`[min_plain_integer, max_plain_integer]` to `bigint` would change observable
standard JSON output. The final standard stringify design needs either a stricter
conversion predicate that proves the bigint decimal spelling matches native
number spelling, or a compatibility-specific number serialization path for the
mismatching values. Do not use the plain-spelling bounds alone as the predicate.

### Questions to investigate

The integer exponent-switch boundary is settled above, but the remaining numeric
policies are still open. Do not choose a concrete overflow representation or the
final integer conversion predicate until the relevant behavior is documented.

- [ ] Verify `JSON.parse` behavior for `0`, `-0`, decimal zero, exponent zero, and
      overflowed exponent syntax such as `1e400`, including `Object.is` checks for
      the resulting values where relevant.
- [ ] Verify native `JSON.parse` behavior for bare integer tokens around and far
      beyond the runtime bigint-size limit, including the point where JavaScript
      number materialization becomes `Infinity`.
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
- [ ] Choose the extended behavior for a valid bare integer whose coefficient
      cannot be constructed as a runtime `bigint`. The implementation must detect
      this before an unsupported `BigInt(NumberToken.value)` operation can escape;
      either preserve/materialize it through an explicit representation or return
      a controlled extended-parse failure.
- [ ] Preserve the original numeric lexeme through the shared structural parse so
      the standard compatibility parser can materialize oversized bare integers
      with native `number` semantics even when extended bigint materialization is
      unavailable.
- [ ] If no clean `ExtendedUnknown` representation satisfies an overflow case,
      explicitly design a standard compatibility materializer over the same
      lossless structural tree instead of duplicating the parser or rejecting
      syntax that native `JSON.parse` accepts.
- [ ] Define the matching extended-serialization/error behavior for any value or
      representation chosen for overflowed exponent or oversized bare-integer
      input so parse/serialize has a coherent contract.
- [x] Determine the positive plain-integer spelling boundary:
      `max_plain_integer = 999999999999999900000`; the next double is `1e21` and
      native `JSON.stringify` switches to exponent notation there.
- [x] Determine the negative boundary independently and verify symmetry:
      `min_plain_integer = -999999999999999900000`; the next magnitude is
      `-1e21` and native `JSON.stringify` uses exponent notation.
- [x] Use plain-spelling terminology rather than `safe integer` terminology so
      these serialization bounds cannot be confused with
      `Number.MAX_SAFE_INTEGER` / `Number.MIN_SAFE_INTEGER`.
- [ ] Test representative and boundary-adjacent unsafe integers throughout the
      plain-spelling interval and compare `JSON.stringify(value)` with
      `BigInt(value).toString()`.
- [x] Determine whether the min/max interval alone guarantees exact native
      spelling after conversion to `bigint`: it does not. The upper boundary is
      already a counterexample (`999999999999999900000` vs exact bigint
      `999999999999999868928`).
- [ ] Define the stricter conversion predicate or standard-only number serializer
      required for plain-spelled integer values whose bigint decimal spelling does
      not equal native `JSON.stringify` output.
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
      JSON surfaces is considered complete, including an oversized bare integer
      that cannot be directly materialized as runtime `bigint`.

### Related

- [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md) — owns the
  information-preserving intermediate JSON representation and is blocked on this
  task for exponent-overflow, oversized-integer, and non-finite behavior.
- [Standard JSON transformer](./standard-transform.md) — now also blocked on this
  investigation for the exact integer-to-bigint/stringify compatibility policy.
- [`fjs/media/json/module.f.ts`](../module.f.ts) — current standard JSON surface.
- [`fjs/media/json/serializer/module.f.ts`](../serializer/module.f.ts) — current
  number serialization behavior to compare with native `JSON.stringify`.
