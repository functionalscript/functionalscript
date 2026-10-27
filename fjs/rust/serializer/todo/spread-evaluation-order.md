## Expand array and call spreads before later operands

**Priority:** P1
**Status:** open

The Rust serializer postpones array/call spread expansion until every item
operand has evaluated. This can replace a reached spread failure with a later
divergence. The problem does not require a shared graph node.

This admitted source fails while expanding `null` in native JavaScript and in
the memo and Amnesia executors:

```js
const forever = () => { while (true) {} return 0 }
export default [...null, forever()]
```

Its generated Rust instead diverges. The array printer in
[`module.f.mjs`](../module.f.mjs) produces the equivalent of:

```rust
spread_array([
    spread_item(Nullish::Null.to_any()),
    value_item(Any::call(forever, args)?),
])
```

Rust evaluates the complete item array before `spread_array` can check and
expand its first item. The `forever` call therefore runs before the failing
expansion. An ordinary call with `...null` before its divergent later argument
has the same defect.

The source above reproduces at parent revision
`30e0652bb948d8a161173a90e7e7c5f0a8d0ba48`; its generated Rust is byte-identical
before and after the shared-owner ordering correction in `edag/to_fast`.
Shared-owner placement and this target's spread expansion are separate defects.
The shared-owner correction does not claim to fix this one.

### Tasks

- [ ] Establish each reached spread expansion before evaluating the following
      array element or call argument, preserving element identities and order.
- [ ] Retain callee/receiver lookup before arguments and keep optional-call
      expansion inside its selected region.
- [ ] Prove reached failure versus later divergence for both arrays and calls,
      with unshared operands and later shared demands. Compare native JavaScript,
      both represented executors and generated Rust through repeated graph
      conversions; preserve existing successful spread behavior.
