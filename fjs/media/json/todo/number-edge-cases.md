## Investigate JSON numeric edge cases

**Priority:** P3
**Status:** open

### Problem

The shared JSON tokenizer can preserve every valid numeric token as text, but the
runtime layers still need explicit policies for values that do not map cleanly to
their ordinary numeric types.

This investigation owns those **FunctionalScript codec** decisions. It does not
require the default `fjs/media/json` API to mimic native `JSON.parse` /
`JSON.stringify`.

There are two runtime codecs with different goals:

- extended JSON preserves bare integer syntax as `bigint` and decimal/exponent
  syntax as `number`;
- standard FunctionalScript JSON materializes the ordinary bigint-free
  `fjs/media/json.Unknown` domain and emits deterministic valid JSON according to
  its own documented contract.

Exact native `JSON.*` compatibility is P5 follow-up work in
[native JSON compatibility](./native-json-compatibility.md). Do not spend P3
implementation or investigation time on host-specific equivalence unless it is
needed to choose the FunctionalScript codec's own behavior.

The edge cases that still matter to the FunctionalScript codecs are:

- negative zero (`-0`);
- positive infinity (`Infinity`);
- negative infinity (`-Infinity`);
- `NaN`;
- exponent syntax whose numeric conversion overflows the finite JavaScript
  `number` range, such as `1e400`;
- bare integer syntax whose coefficient is too large for the runtime's `bigint`
  implementation to construct directly;
- finite integer-valued `number`s that need a non-bigint lexical spelling when
  preserving the runtime `number` type in extended JSON.

JSON text itself cannot spell `NaN` or infinities, but callers can still construct
runtime values containing them and pass those values to a serializer. Therefore
serialization needs a deliberate policy even though parsing never receives such
literals directly.

### Lossless numeric source

`NumberToken.value` is the canonical source for numeric text until materialization
is complete.

Do not depend on `NumberToken.bf` being exact for arbitrarily large exponent text:
the current tokenizer accumulates exponent digits through JavaScript `number`, so
an unbounded exponent can lose precision or become infinite. Exact decisions must
use the original lexeme or another representation that preserves it without
narrowing first.

This also protects the bare-integer path. The structural parser must retain the
lexeme before any `BigInt(NumberToken.value)` call, because a valid JSON integer
can exceed the runtime bigint-size limit. Such input must produce a documented
materialization result or controlled parse failure, never an uncaught runtime
exception.

### Extended JSON questions

The lexical split itself is settled:

```text
bare integer without `.` / `e` / `E` -> bigint
exact `-0`                            -> negative-zero number
contains `.` / `e` / `E`             -> number
```

The remaining extended questions are exceptional cases where that lexical rule
cannot directly produce an ordinary runtime leaf.

#### Exponent overflow

A valid token such as `1e400` is lexically a `number`, but ordinary conversion may
produce `Infinity`.

Choose one explicit extended policy, for example:

- allow the resulting non-finite `number` as an extended runtime leaf;
- preserve another internal representation until a later conversion;
- return a controlled extended-parse failure.

Choose the simplest coherent FunctionalScript contract; matching native
`JSON.parse` is not a requirement.

#### Oversized bare integers

A valid bare integer can be too large for runtime bigint construction.

The extended materializer must detect/contain this case and choose a controlled
policy. It may fail if the runtime domain genuinely cannot represent the value;
that does not prevent the standard FunctionalScript parser from consuming the
same lossless structural tree with a different numeric policy.

#### Non-finite programmatic numbers

Choose whether the extended serializer rejects, normalizes, or otherwise handles
`NaN` / `Infinity` / `-Infinity` supplied programmatically. Whatever is chosen
must still emit valid JSON or fail explicitly.

#### Negative zero

Extended JSON deliberately distinguishes `-0` from bigint zero, because bigint
has no negative-zero value. Preserve this distinction through the extended
parse/serialize contract unless the investigation identifies a stronger reason to
change it.

### Standard FunctionalScript JSON questions

The ordinary `json.parse` / `json.stringify` codec is specified separately in
[standard-parse-serialize.md](./standard-parse-serialize.md). It may materialize
standard numeric leaves directly from the lossless structural tree instead of
routing through `ExtendedUnknown`.

This investigation only needs to settle the default standard codec's exceptional
number behavior:

- how a valid token that numerically overflows finite JavaScript `number` is
  represented in `json.Unknown`;
- how negative zero is preserved or normalized by the default FunctionalScript
  parser/stringifier;
- how programmatic `NaN` / infinities are handled by the serializer;
- what deterministic valid JSON spelling is used for finite `number` values when
  exact native shortest-decimal output is not a requirement.

A simple FunctionalScript contract is preferable to reproducing host quirks.
Later, after the Extended JSON codec and the standard/extended transforms exist,
we may choose to move `json.*` closer to native behavior through documented
breaking changes. If both contracts turn out to be useful, a separate compatible
API remains an option. That decision is intentionally deferred to P5.

### Native compatibility is P5

Do not add native differential tests, spelling-boundary investigations, or API
parity work to this P3 task. Existing measurements can remain as historical
reference elsewhere, but no additional compatibility work is required here.

See [native JSON compatibility](./native-json-compatibility.md).

### Tasks

- [ ] Verify and document the lexical rule that every token containing `.` or
      `e` / `E` belongs to the extended `number` branch, while bare integers
      belong to bigint except exact `-0`.
- [ ] Verify that exact numeric decisions use `NumberToken.value` and remain
      bounded by input length; do not narrow an unbounded exponent first.
- [ ] Choose the extended policy for exponent overflow such as `1e400`.
- [ ] Choose the extended policy for a valid bare integer whose coefficient
      cannot be constructed as runtime bigint; no uncaught `BigInt(...)` limit
      failure may escape.
- [ ] Define matching extended serialization/failure behavior for any exceptional
      representation accepted by the parser.
- [ ] Decide how the extended serializer handles programmatic `NaN`, `Infinity`,
      and `-Infinity`.
- [ ] Preserve/test negative-zero behavior in the extended codec.
- [ ] Choose the default FunctionalScript standard parse policy for valid numeric
      tokens that become non-finite JavaScript numbers.
- [ ] Choose the default FunctionalScript standard stringify policy for `-0`,
      `NaN`, `Infinity`, and `-Infinity`.
- [ ] Define a deterministic finite-number serialization rule sufficient for the
      FunctionalScript standard codec.
- [ ] Add proof cases for every settled default behavior, including oversized bare
      integer input, unbounded exponent text, negative zero, fractions, ordinary
      exponents, exponent overflow, and programmatic non-finite numbers.
- [ ] Do not add native-compatibility work here; defer it to the P5 TODO.

### Related

- [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md) — blocked on
  this task for extended exceptional-number materialization/serialization policy.
- [Standard JSON parse/serialize](./standard-parse-serialize.md) — owns the default
  bigint-free FunctionalScript codec.
- [Standard/extended value transforms](./standard-transform.md) — reusable runtime
  conversions; they do not depend on native stringify compatibility.
- [Native JSON compatibility](./native-json-compatibility.md) — P5 follow-up; does
  not block this investigation.
- [`fjs/media/json/module.f.ts`](../module.f.ts) — current ordinary JSON surface.
- [`fjs/media/json/serializer/module.f.ts`](../serializer/module.f.ts) — current
  primitive serialization implementation to replace/self-host.
