## The slider's value is computed in the runtime, not the demo

**Priority:** P4
**Status:** open

### Problem

[`demo-runtime.mjs`](../../demo-runtime.mjs) is "the one impure half of every
demo", but its `pointermove` handler does arithmetic the demo owns: it reads
`data-demo-x-min`, `-max`, `-left` and `-right` off the SVG, maps the
pointer's x through the affine map, clamps to the input's `min`/`max`, rounds
with `toFixed(3)`, and only then sends the `input` event. The attribute
names and the mapping are a contract between one producer — `realGraph` in
[`fjs/crypto/secp/demo.f.mjs`](../../../crypto/secp/demo.f.mjs) — and the
runtime, named on neither side and proven nowhere.

### Proposal

A pure `dragValue` in [`module.f.mjs`](../module.f.mjs), beside `DemoEvent`,
over numbers alone: `(axis: { min, max, left, right }, bounds: { min, max },
x) => string | null`, answering `null` where `right <= left` leaves no axis
to map onto, and the attribute names as an exported record the `secp` demo
spreads into its SVG. Every argument is plain data the proof can build. The
DOM stays in the host: it reads the four attributes off the SVG, the
pointer's `x` through `getScreenCTM`, and the input's `min` and `max` off
the `range` element `byName` finds — `Number(range.min)`, `Number(range.max)`
— and passes the numbers; the element itself never crosses into the
module. The `range === null` lookup stays the host's too. The
`secp` demo is the producer it serves today; the arithmetic and the clamp
get a proof, and the vocabulary stops being two string literals that must
agree.

### Tasks

- [ ] `dragValue` and the attribute record, with proof.
- [ ] `demo-runtime.mjs` and `secp/demo.f.mjs` use them.

### Related

- [oversized-utf8-input](./oversized-utf8-input.md) — another demo input the
  runtime handles.
