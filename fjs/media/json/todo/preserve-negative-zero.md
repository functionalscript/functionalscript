## Preserve negative zero

**Priority:** P3
**Status:** open

### Problem

The standard JSON serializer's `numberSerialize` delegates to `JSON.stringify`,
which writes `-0` as `0`. The parser already reads the signed lexeme with
`parseFloat` and preserves negative zero, but a serialize/parse round trip loses
it. Negative zero is valid JSON syntax; preserving it is an intentional
difference from native `JSON.stringify`, not an extension to JSON.

DataJS already preserves `-0`, but its `_numberSerialize` owns a separate copy
of the sign-preserving number spelling. Share the finite-number formatter
rather than maintaining the same rule in both codecs.

### Proposal

Keep `numberSerialize` in [`../serializer/module.f.mjs`](../serializer/module.f.mjs)
as the shared export:

```js
const jsonStringify = JSON.stringify

export const numberSerialize
    = input => [Object.is(input, -0) ? '-0' : jsonStringify(input)]
```

DataJS imports that export. Its existing `_numberSerialize` remains a thin
policy wrapper so its callers, including the compiler, keep the same surface:

```js
export const _numberSerialize = value => Number.isFinite(value)
    ? numberSerialize(value)
    : [`${value}`]
```

Only finite-number spelling is shared: JSON still writes `null` for `NaN`,
`Infinity`, and `-Infinity`; DataJS must retain its `NaN`, `Infinity`, and
`-Infinity` spellings. Do not route those DataJS values through JSON's
non-finite policy.

Keep the existing parser and its `Result` API. Read the complete signed lexeme
and pin the behavior with proofs; there is no need for a second parser or a new
numeric policy just to preserve a sign that the current parser already keeps.

This task concerns the standard bigint-free JSON codec and DataJS's reuse of
its finite formatter. Do not change Extended JSON's number/bigint rules.
Replacing the remaining host formatter is separate work in
[remove-native-json](./remove-native-json.md); it must retain this contract.

### Tasks

- [ ] Preserve `-0` in JSON's shared `numberSerialize`, keep positive zero as
      `0`, and make DataJS's `_numberSerialize` reuse it for finite numbers.
      Keep the sign check in one place.
- [ ] Add serializer proofs for `-0` and `0` through `numberSerialize`,
      `serialize`, and `stringify`, including array and object leaves.
- [ ] Add parser regression proofs for `-0`, `-0.0`, `-0e0`, `-0E+0`, and
      negative underflow such as `-1e-400`, plus their unsigned counterparts.
      Cover nested values and retain existing malformed-input refusals.
- [ ] Prove serialize/parse round trips preserve both zeros, alone and nested,
      using `Object.is` on numeric leaves, not `===`. Exercise both JSON and
      DataJS, including DataJS output `export default -0;`.
- [ ] Pin the non-finite split: JSON still emits `null`; DataJS still emits and
      reparses `NaN`, `Infinity`, and `-Infinity`. Exercise both branches of
      DataJS's wrapper and retain ordinary finite-number round-trip coverage.
- [ ] Document the intentional difference from native `JSON.stringify` in the
      JSON README/JSDoc. Declare the changed output bytes for `-0` in the
      implementation PR, including the effect on content hashes. Update
      expectations that previously required `0` for a negative-zero input.
- [ ] Run the required checks with the implementation (`tsc`, `fjs test`, and
      the complete `node --test` suite), then remove this TODO once the contract
      survives in the module documentation and proofs.

### Related

- [JSON numeric edge cases](./number-edge-cases.md) — this settles negative zero;
  the remaining numeric-policy questions stay there.
- [Native JSON compatibility](./native-json-compatibility.md) — preservation is a
  deliberate default-policy exception, not a native-parity bug.
- [`JSON module`](../module.f.mjs) — public codec and signed-lexeme numeric policy.
- [`DataJS serializer`](../../datajs/serializer/module.f.mjs) — consumer of the
  shared finite formatter, with its own non-finite policy.
- [`DataJS specification`](../../../../spec/datajs/README.md) — existing
  negative-zero and non-finite round-trip requirements.
- [json-dialect-factory](../../todo/json-dialect-factory.md) — plans to refuse
  `-0` in dialect values because the serializer loses it today; this change
  removes that reason.
