## Convert computed object keys before property values

**Priority:** P1
**Status:** wip

Rust output delays a computed property key's string conversion until after its
value operand has evaluated. The object printer in
[`module.f.mjs`](../module.f.mjs) spells `computed_item(key, value)?`; Rust
evaluates both arguments before that helper converts the key. A reached key
conversion must finish before the value starts.

This admitted source fails in the key's `toString` callback under native
JavaScript and both represented executors:

```js
const key = { toString: () => null.x }
const forever = () => { while (true) {} return 0 }
export default { [key]: forever() }
```

Generated Rust instead calls `forever` before entering `computed_item`, so it
diverges before reaching the key failure. Neither shared nodes nor required
value-block anchors are needed to expose the defect.

The example reproduces at
`30e0652bb948d8a161173a90e7e7c5f0a8d0ba48`. Its generated Rust is byte-identical
before and after the common operand-anchor construction correction. Preserving
operand-local anchors in EDAG does not fix this target helper's delayed
conversion.

### Tasks

- [ ] Convert each reached computed key before evaluating its property value,
      without duplicating key evaluation or conversion.
- [ ] Preserve selected regions, property order and established value identities.
- [ ] Compare failure versus later divergence in native JavaScript, memo,
      Amnesia and generated Rust, including multiple properties and successful
      key conversion through repeated graph/source conversions.

Array/call spreads [establish their iterators at each operand's
position](../README.md). Computed key conversion still needs its own ordering
before the property value.
