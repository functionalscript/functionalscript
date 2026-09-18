# Undefined Properties: Representation and Observations

**Priority:** P1
**Status:** open

## Problem

This question arose in [PR #1888](https://github.com/functionalscript/functionalscript/pull/1888)
while designing `hasOwn`: should undefined-valued properties disappear in the
language surface, during construction, or only during a lookup? The old
[direct `Object.hasOwn` proposal](./2345-has-own-property.md) is now withdrawn.
Its replacement asks about descriptor enumerability through an explicit pattern.

A representation choice cannot answer that source pattern differently merely
because the VM calls a property absent. The [compatibility principles](../README.md#principles)
fix successful observations; the representation is an implementation choice
within that constraint, not a competing source semantics.

## Constraints

The duplicate-key constraint does not depend on a presence instruction:

```js
const a = { x: 1, x: undefined };
export default a.x; // undefined
```

Dropping the final pair before applying it would leave `x` equal to `1`.
That is not compatible with the original property read.

The additional presence constraint uses the **complete proposed raw-flag
helper pattern** from [enumerable presence](./2345-has-own-property.md):

```js
const hasEntity = (a, b) =>
    Object.getOwnPropertyDescriptor(a, b)?.enumerable;

const a = { x: 1, x: undefined };
export default [a.x, hasEntity(a, "x")];
// JavaScript: [undefined, true]
```

This is a proposed pattern, not a claim that the feature is implemented today.
Once admitted, its successful observations must be preserved. The helper's
final name and raw-flag-versus-boolean API remain the presence TODO's decision;
this example illustrates the raw-flag candidate without selecting it.

A standalone descriptor expression may be represented in the JavaScript-subset
AST but is refused by FJS admission outside a complete approved pattern.
Removing `Object.hasOwn` does not erase the proposed helper's observation:
answering `undefined` instead of `true` because the VM calls the entry absent
would change a successful result.

[Undefined properties](./1010-undefined-property.md) carries the spread and
insertion-order counterexamples. Only a normalization proven equivalent for
all admitted observations is allowed. No particular storage layout is required;
retaining enough information to reproduce those observations is required.

## Implementation evidence and remaining work

Existing object-construction paths are useful evidence, not definitions of the
language. When implementing a normalization, inspect the shared EDAG object
operation, NaNVM's `ToObject::to_object`, and the Rust emitter's object lowering
together. The historical investigation found these paths retaining
undefined-valued entries, not a completed universal-removal feature. Do not
infer a new language rule from one backend or use a proof executor as the
sole authority.

## Tasks

- [x] Remove the alternative that an internally defined absence can justify a
      different successful result for an admitted JavaScript pattern.
- [ ] Audit construction, presence, overwrite and order through the relevant
      EDAG/NaNVM/writer paths when implementing the enumerable-presence pattern.
- [ ] Add the duplicate-key regression and composition regressions to the
      shared conformance corpus, retaining unsupported-input refusals.
- [ ] Once supported, test the complete helper through AST-to-EDAG admission
      and execution; refuse unmatched descriptor uses even when they parse.
- [ ] Specify a normalization only with its observation domain and proof;
      leave physical representation open otherwise.

## Related

- [Undefined properties](./1010-undefined-property.md) — observation constraints.
- [Enumerable presence](./2345-has-own-property.md) — the replacement pattern;
  raw flag versus boolean is an explicit API choice, not a representation choice.
- [Compatibility epic](../../todo/fjs-javascript-compatibility.md).
- [Blocked research](../../todo/blocked/undefined-removes-property.md) — neither
  directs nor blocks current development while in `todo/blocked/`.
