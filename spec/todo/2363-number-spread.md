## `Number(...a)`

**Priority:** P3
**Status:** open

### Problem

`Number(...a)` is a JavaScript call FunctionalScript refuses
(`Number takes one argument`) rather than answering it wrongly. JavaScript
yields every value the spread has, then converts the first, or answers `0`
where the spread yields none, as `Number()` does: `Number(...["4", "x"])` is
`4`, `Number(...[undefined])` is `NaN`, and `Number(...[])` is `0`, not
`NaN`. The same holds wherever a spread stands among the arguments:
`Number(...a, b)` converts `b` where `a` yields nothing.

The conversion is the EDAG's `['Number', exp]`, a node of one operand, and
a call's arity is the callee's to split, so no node says "the first value of
an argument list, or `0` where it has none". `Number(a, b)` has a home, the
comma operator ([operators](./2340-operators.md)); this shape has none.

### Proposal

None settled. A candidate needs no new node: the argument list built once as
an array, `xs`, and the conversion read from it,
`xs.length === 0 ? 0 : Number(xs[0])`. `[...a]` yields what the call's
spread yields, so `Number(...[])` stays `0` and `Number(...[undefined])`
`NaN`. Its cost is the round trip: the FunctionalScript writer spells the
expansion, not the call that was written.

### Tasks

- [ ] Choose the representation, and record it where the spec describes the
      conversion.
- [ ] Admit every argument list holding a spread, with proofs against
      JavaScript for a spread yielding no value, one and several — the empty
      spread answering `0`.

### Related

- [number-call](./2362-number-call.md) — the conversion, which refuses this
  shape by name.
- [operators](./2340-operators.md) — `Number(a, b)`, which lands with the
  comma.
