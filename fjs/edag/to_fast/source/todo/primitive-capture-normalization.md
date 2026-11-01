## Preserve primitive captures on source readback

**Priority:** P3
**Status:** wip

### Problem

A shared sequence can be emitted as valid source, then normalize to a
primitive capture when that source is parsed. The resulting graph preserves
the program's values but fails a subsequent source write with
`a frame slot holding a primitive`.

This supplied EDAG uses the same `sequence` object in the array and capture:

```js
const sequence = [',', [['[]', []], ['undefined']]];
const graph = ['[]', [sequence, ['=>', 0, [sequence], ['frame', 0]]]];
```

The first `tryStringify(graph)` succeeds:

```js
const $0=(()=>{const $1=[];return undefined;})();export default [$0,()=>$0];
```

Parsing that output and selecting its default-export EDAG succeeds. Both the
array's first element and a call of its second element evaluate to `undefined`.
The normalized closure frame now holds tagged `undefined`, and the next
`tryStringify` is refused by the existing primitive-frame restriction.

### Scope

Support repeated source output for captures that normalize to primitive values,
starting with this `undefined` fixture. Preserve required sequence work,
successful values, capture lifetimes and allocation sharing. State the supported
normalization domain before claiming graph identity, stable hashes or a
graph/text fixed point. This TODO makes no compiler or admission change.

### Tasks

- [ ] Handle a captured sequence result that becomes a primitive on source
      parsing while preserving its evaluation and capture contract.
- [ ] Verify the first and subsequent source outputs within the declared
      normalization domain, including the literal fixture above.

### Related

- [Source admission](../module.f.mjs) — the current primitive-frame restriction.
- [Graph identity and normalization](../../README.md) — capture layouts and the
  supported round-trip domain.
- [Shared-sequence proofs](../../../../compiler/serializer/shared_comma.proof.f.mjs)
  — `sequenceCapturesCanNormalizeToPrimitiveValues` checks the first output's
  values without making the later refusal a permanent expectation.
