## Settle the standard JSON codec's numeric edge cases

**Priority:** P3
**Status:** open

### Problem

The shared JSON tokenizer preserves every valid numeric token as text, and the
shared structural parser hands that text to a per-codec numeric policy — see
[`fjs/media/json/README.md`](../README.md). Each runtime codec still needs an
explicit policy for values that do not map cleanly onto its numeric type.

This investigation owns those **FunctionalScript codec** decisions. It does not
require the default `fjs/media/json` API to mimic native `JSON.parse` /
`JSON.stringify`. Exact native `JSON.*` compatibility is P5 follow-up work in
[native JSON compatibility](./native-json-compatibility.md).

It also does **not** own DJS `.f.js` spellings. DJS is a JavaScript-syntax
superset and can represent values that standard JSON cannot. The DJS requirement
to round-trip `-0`, `NaN`, `Infinity`, and `-Infinity` is tracked by
[`compile-modules-to-edag.md`](../../../djs/todo/compile-modules-to-edag.md).
That work must not silently redefine the standard JSON codec's policy here.

The extended codec's decisions are settled and shipped (below). What remains
open is the **standard** bigint-free codec, whose serializer still delegates
finite-number spelling to the host's `JSON.stringify`.

### Settled: extended codec

Implemented in [`../extended/module.f.mjs`](../extended/module.f.mjs) and
documented in [`../README.md`](../README.md):

| Case                                    | Decision                                              |
| --------------------------------------- | ----------------------------------------------------- |
| bare integer syntax                     | `bigint`, materialized from the lexeme                |
| exact `-0`                              | negative-zero `number` (`bigint` has no negative zero) |
| `.` / `e` / `E` syntax                  | `number`, even when the value is integral              |
| exponent overflow (`1e400`)             | parse `error`; the extended domain has no non-finite `number` |
| exponent underflow (`1e-400`)           | `0`; ordinary `number` rounding, not an error          |
| programmatic `NaN` / `±Infinity`        | serialized as `null`, as `JSON.stringify` does         |
| whole-valued `number`                   | serialized as `3.0` (or its own exponent spelling) so it reparses as `number` |
| `bigint`                                | serialized as full base-10 digits, never exponent notation |

### Settled: exact checks stay bounded

Exact numeric questions are answered from the lexeme in the length of the
token, by [`../number/module.f.mjs`](../number/module.f.mjs): no coefficient
bigint, no exponent conversion, and no `10 ** exponent`. `1e-99999999999999999999`
is classified from a sign and a length.

### Known limit: oversized bare integers

A valid bare integer beyond the runtime's bigint limit (V8: above 2^30 bits,
some 3.2e8 decimal digits) throws inside `BigInt`. FunctionalScript has no
`try`/`catch`, so this cannot be contained as a `Result`, and predicting it
from a digit count is exactly the size-estimating preflight AGENTS.md §5.6
rules out. It is documented as a runtime limit in
[`../README.md`](../README.md). Reopen it only if FunctionalScript gains a
fallible-call primitive — a `tryBigInt`-shaped boundary would then be the
right answer, and the extended policy's `Result` already has a place for it.

Note that nothing before that point narrows: the tokenizer and the structural
parser handle such a document at full size, and the standard codec materializes
it as a `number` without ever constructing a bigint.

### Open: standard FunctionalScript JSON codec

The ordinary `json.parse` / `json.stringify` codec is specified in
[standard-parse-serialize.md](./standard-parse-serialize.md). Its parse policy
is already explicit — every token becomes a `number`, read the way JavaScript
reads that text, so `1e400` is `Infinity` and `1e-400` is `0`. What is still
undecided is serialization:

- what deterministic valid JSON spelling is used for finite `number` values,
  now that `numberSerialize` still calls the host's `JSON.stringify`;
- how negative zero is preserved or normalized (`JSON.stringify(-0)` is `0`);
- how programmatic `NaN` / infinities are handled;
- whether a parsed `Infinity` is representable in `json.Unknown` at all, or
  should be normalized on the way out.

A simple FunctionalScript contract is preferable to reproducing host quirks.
Moving `json.*` closer to native behavior through documented breaking changes,
or adding a separate compatible API, is deliberately deferred to P5.

### Tasks

- [ ] Choose the default FunctionalScript standard stringify policy for `-0`,
      `NaN`, `Infinity`, and `-Infinity`.
- [ ] Define a deterministic finite-number serialization rule sufficient for the
      FunctionalScript standard codec, and stop routing it through the host's
      `JSON.stringify`.
- [ ] Decide how a non-finite `number` parsed from valid text is represented or
      normalized in `json.Unknown`.
- [ ] Add proof cases for every settled default behavior, including oversized
      bare integer input, unbounded exponent text, negative zero, fractions,
      ordinary exponents, exponent overflow, and programmatic non-finite numbers.
- [ ] Do not add native-compatibility work here; defer it to the P5 TODO.

### Related

- [`fjs/media/json/README.md`](../README.md) — the shipped codec architecture and
  the settled extended policy.
- [Standard JSON parse/serialize](./standard-parse-serialize.md) — owns the default
  bigint-free FunctionalScript codec.
- [Standard/extended value transforms](./standard-transform.md) — reusable runtime
  conversions; they do not depend on native stringify compatibility.
- [Native JSON compatibility](./native-json-compatibility.md) — P5 follow-up; does
  not block this investigation.
- [`fjs/media/json/serializer/module.f.mjs`](../serializer/module.f.mjs) — current
  primitive serialization implementation to replace/self-host.
- [`fjs/djs/todo/compile-modules-to-edag.md`](../../../djs/todo/compile-modules-to-edag.md)
  — owns DJS `.f.js` round-tripping of special number values needed by EDAG artifacts.
- [`fjs/djs/todo/157-json-djs-shared-value-machine.md`](../../../djs/todo/157-json-djs-shared-value-machine.md) — shared JSON/DJS parser and
  serializer extraction; coordinate reusable machinery without merging codec policy.
