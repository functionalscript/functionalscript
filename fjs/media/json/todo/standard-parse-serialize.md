## Standard JSON parse/serialize

**Priority:** P3
**Status:** open

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

The shared core exists — see [`fjs/media/json/README.md`](../README.md). One
tokenizer keeps every number token as its exact lexeme, and one container state
machine hands that token to the codec's own `NumberPolicy`:

```text
JSON text -> tokenizer -> parse(policy) -+-> json.Unknown       (number)
                                         +-> extended.Unknown   (number | bigint)
                                         +-> RTTI               (Ts<T>)
```

Standard parsing therefore materializes `json.Unknown` directly, without an
intermediate extended value and without ever constructing a bigint, and
`treeSerialize` already gives both codecs one recursive object/array walk with
a per-codec leaf formatter.

### Standard parse

Done: `json.parse` reads each number token's lexeme with `parseFloat`, so a
valid token materializes the way JavaScript itself reads that text. Malformed
input remains an ordinary `Result` failure.

What is left here is the *serialization* side, plus deciding whether a
non-finite parse result should be normalized at all — see
[number-edge-cases.md](./number-edge-cases.md).

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

- [x] Add/rebase the standard materializer onto the shared structural parse.
- [x] Keep `NumberToken.value` available until numeric materialization is complete.
- [x] Ensure oversized valid numeric tokens do not require successful intermediate
      bigint construction merely to reach the standard parser.
- [x] Reuse one recursive structural serializer (`treeSerialize`); adapt numeric
      leaf formatting rather than creating another object/array walker.
- [ ] Define the FunctionalScript finite-number serialization contract: valid,
      deterministic JSON with correct reparsing semantics, without delegating to
      the host's `JSON.stringify`.
- [ ] Choose explicit default behavior for `-0`, non-finite programmatic numbers,
      and numeric overflow through [number-edge-cases.md](./number-edge-cases.md).
- [ ] Keep the existing `Result`-returning parse API unless a separate task has a
      reason to change it.
- [ ] Add proofs against the FunctionalScript codec contract, not against native
      `JSON.*` byte-for-byte behavior.
- [ ] Do not spend implementation time on native compatibility in this task; it is
      P5 follow-up work.
- [ ] `npx tsc`, `fjs test`.

### Related

- [`fjs/media/json/README.md`](../README.md) — the shared lossless structural
  parse, its numeric-policy seam, and the extended codec built on it.
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
