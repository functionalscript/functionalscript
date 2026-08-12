## Standard JSON parse/serialize

**Priority:** P3
**Status:** blocked
**Blocked by:** [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md)

### Problem

`fjs/media/json` should own a complete standard JSON codec implemented in
FunctionalScript.

The near-term goal is intentionally small: accept and produce valid JSON for the
ordinary bigint-free `json.Unknown` domain using the same lossless structural
machinery as extended JSON. Exact compatibility with native JavaScript
`JSON.parse` / `JSON.stringify` is **not** part of this task.

The current `fjs/media/json.parse` already intentionally differs from native
`JSON.parse` at the API level by returning `Result<Unknown, string>` instead of
throwing. The parser/stringifier should similarly prefer a simple explicit
FunctionalScript contract over reproducing host-specific edge behavior.

### Shared structural core

Use one tokenizer and one container-building parser. Numeric syntax remains
lossless until a materializer chooses its runtime representation:

```text
JSON text
   |
   v
JSON tokenizer
   |
   v
shared structural parse
(NumberToken leaves, original lexeme preserved)
   |
   +--> extended materializer -> ExtendedUnknown
   |
   +--> standard materializer -> json.Unknown
   |
   +--> RTTI materializer -> Ts<T>
```

Standard parsing may materialize `json.Unknown` directly from this tree rather
than first constructing `ExtendedUnknown`. This matters for a valid integer token
that exceeds the runtime bigint-construction limit: the standard parser can still
choose its own `number` materialization without duplicating tokenization or the
structural parser.

Serialization should likewise share the recursive object/array traversal while
using the standard codec's own numeric leaf formatter.

### Standard parse

Materialize the shared lossless tree into `json.Unknown`.

For numeric leaves, convert valid JSON number syntax to the JavaScript `number`
domain according to the explicit FunctionalScript policy settled by
[number-edge-cases.md](./number-edge-cases.md). `NumberToken.value` remains the
canonical source until materialization is complete so unbounded exponent text and
oversized integer coefficients cannot fail through an accidental intermediate
representation.

Malformed input remains an ordinary `Result` failure.

### Standard stringify

Serialize `json.Unknown` with the shared recursive serializer and a
FunctionalScript-owned numeric formatter.

The default requirements are:

- output is valid JSON text;
- output is deterministic;
- every supported finite `number` has a defined spelling;
- reparsing the emitted numeric spelling under this codec produces the intended
  `number` value;
- `-0`, `NaN`, `Infinity`, and `-Infinity` have explicit documented behavior;
- object-entry ordering follows the serializer's explicit ordering contract.

The formatter does **not** need to emit the same bytes as native
`JSON.stringify`. Native shortest-decimal spelling and other compatibility details
are deferred to the P5 [native JSON compatibility](./native-json-compatibility.md)
task.

### Relationship to value transforms

[standard-transform.md](./standard-transform.md) provides reusable runtime
conversions:

```text
ExtendedUnknown <-> json.Unknown
```

Those transformations are useful once a runtime tree already exists, but they do
not have to define text parsing or serialization.

In particular:

- extended parse and standard parse are separate materializers over one exact
  structural tree;
- callers can convert already-materialized trees through the reusable transforms;
- standard stringify may serialize `json.Unknown` directly rather than first
  forcing it through `standardToExtended`.

This keeps parser/serializer policy separate from generic runtime conversion.

### Tasks

- [ ] Add/rebase the standard materializer from the shared lossless structural
      tree to `fjs/media/json.Unknown`.
- [ ] Keep `NumberToken.value` available until numeric materialization is complete.
- [ ] Ensure oversized valid numeric tokens do not require successful intermediate
      bigint construction merely to reach the standard parser.
- [ ] Define the FunctionalScript finite-number serialization contract: valid,
      deterministic JSON with correct reparsing semantics.
- [ ] Choose explicit default behavior for `-0`, non-finite programmatic numbers,
      and numeric overflow through [number-edge-cases.md](./number-edge-cases.md).
- [ ] Reuse one recursive structural serializer; adapt numeric leaf formatting
      rather than creating another object/array walker.
- [ ] Keep the existing `Result`-returning parse API unless a separate task has a
      reason to change it.
- [ ] Add proofs against the FunctionalScript codec contract, not against native
      `JSON.*` byte-for-byte behavior.
- [ ] Do not spend implementation time on native compatibility in this task; it is
      P5 follow-up work.
- [ ] `npx tsc`, `fjs test`.

### Related

- [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md) — owns the
  shared lossless structural parse and bigint-aware codec.
- [Standard/extended value transforms](./standard-transform.md) — reusable
  runtime-tree conversions.
- [JSON numeric edge cases](./number-edge-cases.md) — settles exceptional numeric
  policy for the FunctionalScript codecs.
- [Native JSON compatibility](./native-json-compatibility.md) — P5 follow-up;
  may later improve `json.*` through breaking changes or add a separate compatible
  API if both contracts are needed.
- [RTTI-aware extended JSON parser](./rtti-parse.md) — another materializer over
  the same lossless number-token tree.
- [Remove native JSON](./remove-native-json.md) — self-hosts serialization.
- [`fjs/media/json/module.f.mjs`](../module.f.mjs) — current ordinary JSON
  `parse` / `stringify` surface.
- [`fjs/media/json/types.ts`](../types.ts) — current ordinary JSON value types.
